#!/usr/bin/env node
/**
 * enrich-opening-hours.mjs
 *
 * Phase 1 (default): fetch each market's contact_website, parse Swedish
 *   opening-hour patterns, and write found / failed JSON files.
 * Phase 2 (--apply): read found.json and insert opening_hour_rules rows
 *   into the DB. Idempotent — skips markets that already have rules.
 *
 * Run:
 *   # Phase 1: scrape + dump (no DB writes)
 *   node scripts/enrich-opening-hours.mjs
 *
 *   # Phase 2: apply found.json to DB after manual review
 *   node scripts/enrich-opening-hours.mjs --apply
 *
 * Env (.env or shell):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Output files (next to script):
 *   opening-hours-found.json   — markets with parsed rules + raw snippet
 *   opening-hours-failed.json  — scrape/parse failures + manual-followup
 *                                 candidates (phone/email only)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plainTextLines, normalizeTime, sleep } from './lib/scrape-helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FOUND_PATH = join(here, 'opening-hours-found.json')
const FAILED_PATH = join(here, 'opening-hours-failed.json')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

// Detect anon-vs-service-role mix-ups before any query runs. Anon keys
// respect RLS policies and silently return a filtered subset, which
// burned us once already (76 rows back instead of 1146 — turned out to
// be the anon key in .env). Decode the JWT payload (no signature check
// — we just want the `role` claim).
function decodeJwtRole(token) {
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json).role ?? 'unknown'
  } catch { return 'unparseable' }
}
const role = decodeJwtRole(SERVICE_KEY)
if (role !== 'service_role') {
  console.error(`SUPABASE_SERVICE_ROLE_KEY decodes as role="${role}" — must be "service_role".`)
  console.error('Find the right key in Supabase dashboard → Project Settings → API → "service_role" (click Reveal).')
  process.exit(1)
}
const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
}

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')

// ---------------------------------------------------------------------------
// Day-of-week mapping (Swedish). 0 = Sunday … 6 = Saturday — matches
// Postgres extract(dow) and SCHEMA_DAYS in web/.../fleamarkets layout.
// ---------------------------------------------------------------------------

const DAY = {
  son: 0, sön: 0, sond: 0, sondag: 0, söndag: 0, sun: 0, sunday: 0,
  man: 1, män: 1, mån: 1, mandag: 1, måndag: 1, mon: 1, monday: 1,
  tis: 2, tisd: 2, tisdag: 2, tue: 2, tuesday: 2,
  ons: 3, onsd: 3, onsdag: 3, wed: 3, wednesday: 3,
  tor: 4, tors: 4, torsd: 4, torsdag: 4, thu: 4, thursday: 4,
  fre: 5, fred: 5, fredag: 5, fri: 5, friday: 5,
  lor: 6, lör: 6, lord: 6, lordag: 6, lördag: 6, sat: 6, saturday: 6,
}

function dayKeyToNum(s) {
  return DAY[s.toLowerCase().replace(/\.$/, '')] ?? null
}

// "Mån-fre 10-18" or "Måndag–fredag 10:00-18:00" or per-day "Lördag 11-15".
// Also picks up "Vardagar 10-18" → Mon-Fri.
//
// The day expressions are deliberately loose to handle dot abbreviations
// ("Mån.", "Lör."), narrow non-breaking spaces, and the various dash glyphs
// people copy-paste from Word documents (-, –, —, −).
// Trailing \.? tolerates "Mån." / "Fre." style abbreviations.
const DAY_NAME = '(?:m[åa]n(?:dag)?|tis(?:dag)?|ons(?:dag)?|tor(?:s(?:dag)?)?|fre(?:dag)?|l[öo]r(?:dag)?|s[öo]n(?:dag)?)\\.?'
const TIME = '(\\d{1,2})(?:[.:](\\d{2}))?'
const DASH = '\\s*[-–—−]\\s*'
const SPACE = '\\s+'

const PATTERNS = [
  // "Mån-fre 10-18"
  {
    re: new RegExp(`(${DAY_NAME})${DASH}(${DAY_NAME})${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const start = dayKeyToNum(m[1]); const end = dayKeyToNum(m[2])
      if (start == null || end == null) return null
      const open = normalizeTimeFromParts(m[3], m[4])
      const close = normalizeTimeFromParts(m[5], m[6])
      if (!open || !close) return null
      return rangeOfDays(start, end).map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  // "Vardagar 10-18" → Mon-Fri
  {
    re: new RegExp(`vardagar?${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  // "Helger 11-15" → Sat+Sun
  {
    re: new RegExp(`helger?${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [6, 0].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  // "Alla dagar 9-20", "Dagligen 9-20", "Varje dag 9-20", "7 dagar 9-20"
  // → expand to all 7 days. "Öppet alla dagar" is the most common phrasing
  // for shops that don't close on weekends; we'd otherwise miss them
  // entirely because no single-day pattern matches.
  {
    re: new RegExp(`(?:alla\\s+dagar|dagligen|varje\\s+dag|7\\s+dagar)${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  // Single day: "Lördag 11-15", "Mån 10:00-18:00"
  {
    re: new RegExp(`(${DAY_NAME})[\\s:]*${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const d = dayKeyToNum(m[1])
      if (d == null) return null
      const open = normalizeTimeFromParts(m[2], m[3])
      const close = normalizeTimeFromParts(m[4], m[5])
      if (!open || !close) return null
      return [{ day_of_week: d, open_time: open, close_time: close }]
    },
  },
]

function normalizeTimeFromParts(h, m) {
  const hr = Number(h)
  if (!Number.isFinite(hr) || hr < 0 || hr > 23) return null
  const min = m ? Number(m) : 0
  if (min < 0 || min > 59) return null
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function rangeOfDays(start, end) {
  // Swedish convention: "Mån-fre" goes 1..5 in calendar order, "Lör-Sön"
  // goes 6..0 — and the latter wraps because Sunday is day 0. Handle
  // both: if end < start, walk from start through Saturday and then
  // 0..end. Covers "Måndag-Söndag" (1→0 = all 7 days), "Lördag-Söndag"
  // (6→0 = weekend), "Tor-Sön" (4→0 = Thu-Sun).
  const out = []
  if (start <= end) {
    for (let d = start; d <= end; d++) out.push(d)
  } else {
    for (let d = start; d <= 6; d++) out.push(d)
    for (let d = 0; d <= end; d++) out.push(d)
  }
  return out
}

/**
 * Try every pattern over the text and return a deduped list of rules.
 * Captures the longest snippet that produced rules so reviewers can sanity-
 * check what the regex actually matched.
 */
function parseOpeningHours(text) {
  const all = []
  let bestSnippet = ''
  for (const { re, expand } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) != null) {
      const rules = expand(m)
      if (rules) {
        all.push(...rules)
        if (m[0].length > bestSnippet.length) bestSnippet = m[0]
      }
    }
  }
  // Dedupe: a single open-hour entry per (day, open, close)
  const seen = new Set()
  const out = []
  for (const r of all) {
    const k = `${r.day_of_week}|${r.open_time}|${r.close_time}`
    if (!seen.has(k)) { seen.add(k); out.push(r) }
  }
  out.sort((a, b) => a.day_of_week - b.day_of_week)
  return { rules: out, snippet: bestSnippet }
}

// ---------------------------------------------------------------------------
// Fetch + extract
// ---------------------------------------------------------------------------

async function fetchHtml(url) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10_000)
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Fyndstigen/1.0 (+https://fyndstigen.se)' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new Error(`Not HTML: ${ct}`)
    }
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Narrow the page to lines that mention öppet/öppettider/hours, then ±10
 * neighbours so multi-line per-day blocks (Mon\nTue\n...) survive.
 * Falls back to the whole page if no anchor word is found.
 */
function extractCandidateText(html) {
  const lines = plainTextLines(html).split('\n').map((l) => l.trim()).filter(Boolean)
  const anchorRe = /[öo]ppet|[öo]ppettid|[öo]ppning|opening hours/i
  const anchors = []
  lines.forEach((l, i) => { if (anchorRe.test(l)) anchors.push(i) })
  if (anchors.length === 0) return lines.join('\n').slice(0, 4000)
  const keep = new Set()
  for (const i of anchors) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 10); j++) keep.add(j)
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join('\n')
}

// ---------------------------------------------------------------------------
// Phase 1: scrape
// ---------------------------------------------------------------------------

async function loadCandidates() {
  // Use PostgREST embedding to pull markets + their rules in one go,
  // then keep only rows whose rules array is empty. The previous
  // approach fetched markets and rules separately; the markets query
  // hit PostgREST's default 1000-row cap (we have 1146) and the
  // resulting partial list happened to have every id covered by some
  // rule, yielding zero results. Embedding scopes both sides together
  // and survives paging.
  // Page through all non-deleted markets. We have ~1146 rows; PostgREST's
  // default cap is 1000 per page, so do it in 500-row chunks. Filter
  // client-side — small enough that the JS-side work is trivial.
  const select =
    'id,slug,name,city,contact_website,contact_phone,contact_email,' +
    'opening_hour_rules(flea_market_id)'
  const filter = 'is_deleted=eq.false'

  const all = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const url = `${SUPABASE_URL}/rest/v1/flea_markets?select=${encodeURIComponent(select)}&${filter}`
    const res = await fetch(url, {
      headers: { ...headers, range: `${from}-${to}`, 'range-unit': 'items' },
    })
    if (!res.ok) throw new Error(`Markets fetch ${from}-${to}: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE) break
  }

  console.log(`[debug] Fetched ${all.length} markets`)
  const noRules = all.filter((m) => !m.opening_hour_rules || m.opening_hour_rules.length === 0)
  console.log(`[debug] Without opening_hour_rules: ${noRules.length}`)
  const scrapable = noRules.filter((m) => m.contact_website)
  const manualFollowup = noRules.filter((m) => !m.contact_website && (m.contact_phone || m.contact_email))
  console.log(`[debug] Scrapable (has website): ${scrapable.length}`)
  console.log(`[debug] Manual followup (no website, has phone/email): ${manualFollowup.length}`)
  return { scrapable, manualFollowup }
}

async function scrape() {
  const { scrapable, manualFollowup } = await loadCandidates()
  console.log(`Scraping ${scrapable.length} markets with website. Manual-followup pool: ${manualFollowup.length}.`)

  const found = []
  const failed = []

  for (let i = 0; i < scrapable.length; i++) {
    const m = scrapable[i]
    const tag = `[${i + 1}/${scrapable.length}] ${m.name} (${m.city})`
    try {
      const html = await fetchHtml(m.contact_website)
      const text = extractCandidateText(html)
      const { rules, snippet } = parseOpeningHours(text)
      if (rules.length === 0) {
        failed.push({
          id: m.id, slug: m.slug, name: m.name, city: m.city,
          source_url: m.contact_website,
          reason: 'no_pattern_matched',
          phone: m.contact_phone ?? null,
          email: m.contact_email ?? null,
        })
        console.log(`${tag} — no pattern matched`)
      } else {
        found.push({
          id: m.id, slug: m.slug, name: m.name, city: m.city,
          source_url: m.contact_website,
          rules,
          snippet,
        })
        console.log(`${tag} — ${rules.length} rule(s): "${snippet}"`)
      }
    } catch (err) {
      failed.push({
        id: m.id, slug: m.slug, name: m.name, city: m.city,
        source_url: m.contact_website,
        reason: `fetch_failed: ${err.message ?? err}`,
        phone: m.contact_phone ?? null,
        email: m.contact_email ?? null,
      })
      console.log(`${tag} — fetch failed: ${err.message ?? err}`)
    }
    // Be polite — these are mostly small Swedish charity sites.
    await sleep(500)
  }

  // Append manual-followup candidates (no website but have phone/email).
  for (const m of manualFollowup) {
    failed.push({
      id: m.id, slug: m.slug, name: m.name, city: m.city,
      source_url: null,
      reason: m.contact_phone ? 'phone_only' : 'email_only',
      phone: m.contact_phone ?? null,
      email: m.contact_email ?? null,
    })
  }

  writeFileSync(FOUND_PATH, JSON.stringify(found, null, 2), 'utf8')
  writeFileSync(FAILED_PATH, JSON.stringify(failed, null, 2), 'utf8')

  console.log('')
  console.log(`✓ Found:  ${found.length}  → ${FOUND_PATH}`)
  console.log(`✗ Failed: ${failed.length} → ${FAILED_PATH}`)
  console.log('')
  console.log('Review opening-hours-found.json, then run with --apply to write to DB.')
}

// ---------------------------------------------------------------------------
// Phase 2: apply
// ---------------------------------------------------------------------------

async function apply() {
  const found = JSON.parse(readFileSync(FOUND_PATH, 'utf8'))
  console.log(`Applying ${found.length} markets…`)

  // Skip markets that already have rules — defends against re-runs and any
  // manual edits that snuck in between scrape and apply.
  const rulesRes = await fetch(`${SUPABASE_URL}/rest/v1/opening_hour_rules?select=flea_market_id`, { headers })
  const idsWithRules = new Set((await rulesRes.json()).map((r) => r.flea_market_id))

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const m of found) {
    if (idsWithRules.has(m.id)) {
      skipped++
      console.log(`SKIP ${m.name} (${m.city}) — already has rules`)
      continue
    }
    const rows = m.rules.map((r) => ({
      flea_market_id: m.id,
      type: 'weekly',
      day_of_week: r.day_of_week,
      open_time: r.open_time,
      close_time: r.close_time,
    }))
    const res = await fetch(`${SUPABASE_URL}/rest/v1/opening_hour_rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows),
    })
    if (!res.ok) {
      failed++
      console.log(`FAIL ${m.name} (${m.city}) — ${res.status} ${await res.text()}`)
      continue
    }
    applied++
    console.log(`OK   ${m.name} (${m.city}) — ${rows.length} rule(s)`)
  }

  console.log('')
  console.log(`Applied: ${applied}  Skipped: ${skipped}  Failed: ${failed}`)
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

if (APPLY) {
  await apply()
} else {
  await scrape()
}
