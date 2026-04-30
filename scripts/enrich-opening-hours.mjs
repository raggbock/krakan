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
import { sleep } from './lib/scrape-helpers.mjs'
import { parseOpeningHours, extractCandidateText } from './lib/opening-hours-parser.mjs'

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

// Opening-hours parsing (parseOpeningHours, extractCandidateText) lives in
// ./lib/opening-hours-parser.mjs so chain-specific scrapers can share the
// same regex patterns and day-of-week mapping.

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
