#!/usr/bin/env node
/**
 * enrich-contact-emails.mjs
 *
 * Phase 1 (default): for every market without contact_email but with a
 *   contact_website, fetch the website and any obvious "kontakt" pages,
 *   scrape mailto: hrefs + email-pattern text, dump JSON.
 * Phase 2 (--apply): write contact_email back to the DB. Idempotent —
 *   skips markets that already have an email (re-run safe).
 *
 * Run:
 *   node --env-file=.env scripts/enrich-contact-emails.mjs
 *   node --env-file=.env scripts/enrich-contact-emails.mjs --apply
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (must decode as service_role).
 *
 * Output:
 *   scripts/contact-emails-found.json
 *   scripts/contact-emails-failed.json
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sleep } from './lib/scrape-helpers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const FOUND_PATH = join(here, 'contact-emails-found.json')
const FAILED_PATH = join(here, 'contact-emails-failed.json')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
function decodeJwtRole(token) {
  try {
    const payload = token.split('.')[1]
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    return JSON.parse(json).role ?? 'unknown'
  } catch { return 'unparseable' }
}
if (decodeJwtRole(SERVICE_KEY) !== 'service_role') {
  console.error('SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT.')
  process.exit(1)
}
const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
}

const APPLY = new Set(process.argv.slice(2)).has('--apply')

// ---------------------------------------------------------------------------
// Email extraction
// ---------------------------------------------------------------------------

// mailto: hrefs are the most reliable — they're a deliberate publish.
// Plain-text emails come second; we strip `info@` from common host
// shells (info@example.com is fine, but `info@` alone is junk).
const MAILTO_RE = /href=["']mailto:([^"'?\s]+)/gi
const PLAIN_RE = /\b([\w.+-]+@[\w-]+\.[a-z]{2,})\b/gi

// Junk patterns we drop — image hashes, tracking pixels, cdn assets,
// noreply/postmaster shells (those don't lead to a real human).
const JUNK_HOST_RE = /\.(png|jpg|jpeg|gif|svg|webp|css|js|woff2?)$/i
const JUNK_LOCAL_RE = /^(noreply|no-reply|postmaster|abuse|webmaster|info\.)$/i

function isPlausibleEmail(e) {
  if (!e || e.length > 80) return false
  const [local, host] = e.toLowerCase().split('@')
  if (!local || !host) return false
  if (JUNK_HOST_RE.test(host)) return false
  if (JUNK_LOCAL_RE.test(local)) return false
  // Reject TLD-only-domain rubbish like x@y.x
  if (!/\.[a-z]{2,}$/.test(host)) return false
  return true
}

function extractEmails(html) {
  const out = new Set()
  let m
  MAILTO_RE.lastIndex = 0
  while ((m = MAILTO_RE.exec(html)) != null) {
    const e = decodeURIComponent(m[1]).toLowerCase()
    if (isPlausibleEmail(e)) out.add(e)
  }
  PLAIN_RE.lastIndex = 0
  while ((m = PLAIN_RE.exec(html)) != null) {
    const e = m[1].toLowerCase()
    if (isPlausibleEmail(e)) out.add(e)
  }
  return [...out]
}

/** Heuristic: rank Swedish-host emails over generic, contact-style locals
 *  over admin-shells. We pick the highest-scoring one as the primary. */
function rankEmail(email) {
  let score = 0
  const [local, host] = email.split('@')
  if (host.endsWith('.se')) score += 3
  if (/(kontakt|info|hej|butik|loppis|second|hand|kassa|kunder)/.test(local)) score += 2
  if (/(orebro|stockholm|goteborg|malmo|uppsala|gavle|umea|linkoping)/.test(host)) score += 1
  if (local === 'info' || local === 'kontakt') score += 1
  return score
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchHtml(url, timeoutMs = 8000) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
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
 * Try the homepage first, then a handful of likely contact-pages. Stop
 * at the first hit — ranking afterwards picks the best email overall.
 * Common Swedish slugs: /kontakt is dominant, /kontakta-oss occurs on
 * a few church/charity sites, /om-oss less reliable but cheap to try.
 */
const CONTACT_PATHS = ['/kontakt', '/kontakta-oss', '/contact', '/om-oss', '/om']

async function findEmailForSite(rootUrl) {
  const tried = []
  // Homepage first.
  try {
    const html = await fetchHtml(rootUrl)
    const emails = extractEmails(html)
    tried.push({ url: rootUrl, emails })
    if (emails.length > 0) return { primary: pickBest(emails), all: emails, source: rootUrl }
  } catch (err) {
    tried.push({ url: rootUrl, error: String(err.message ?? err) })
  }
  // Then contact pages. Build absolute URLs from the (possibly redirected)
  // root host — but URL parsing of malformed input throws, so guard it.
  let host
  try { host = new URL(rootUrl).origin } catch { host = null }
  if (!host) return { primary: null, all: [], tried }

  for (const path of CONTACT_PATHS) {
    const url = host + path
    try {
      const html = await fetchHtml(url, 5000)
      const emails = extractEmails(html)
      tried.push({ url, emails })
      if (emails.length > 0) return { primary: pickBest(emails), all: emails, source: url, tried }
    } catch (err) {
      tried.push({ url, error: String(err.message ?? err) })
    }
  }
  return { primary: null, all: [], tried }
}

function pickBest(emails) {
  return [...emails].sort((a, b) => rankEmail(b) - rankEmail(a))[0]
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

async function loadCandidates() {
  const select = 'id,slug,name,city,contact_website,contact_email'
  const filter =
    'is_deleted=eq.false' +
    '&contact_email=is.null' +
    '&contact_website=not.is.null' +
    '&published_at=not.is.null' +
    '&is_system_owned=eq.true'

  const all = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const url = `${SUPABASE_URL}/rest/v1/flea_markets?select=${encodeURIComponent(select)}&${filter}`
    const res = await fetch(url, { headers: { ...headers, range: `${from}-${to}`, 'range-unit': 'items' } })
    if (!res.ok) throw new Error(`Markets fetch: ${res.status} ${await res.text()}`)
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE) break
  }
  return all
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function scrape() {
  const candidates = await loadCandidates()
  console.log(`Scraping ${candidates.length} markets…`)

  const found = []
  const failed = []

  for (let i = 0; i < candidates.length; i++) {
    const m = candidates[i]
    const tag = `[${i + 1}/${candidates.length}] ${m.name} (${m.city})`
    try {
      const result = await findEmailForSite(m.contact_website)
      if (result.primary) {
        found.push({
          id: m.id, slug: m.slug, name: m.name, city: m.city,
          source_url: m.contact_website,
          email: result.primary,
          all_emails: result.all,
          email_source: result.source,
        })
        console.log(`${tag} → ${result.primary}`)
      } else {
        failed.push({
          id: m.id, slug: m.slug, name: m.name, city: m.city,
          source_url: m.contact_website,
          reason: 'no_email_found',
          tried: result.tried,
        })
        console.log(`${tag} — no email`)
      }
    } catch (err) {
      failed.push({
        id: m.id, slug: m.slug, name: m.name, city: m.city,
        source_url: m.contact_website,
        reason: `unhandled: ${err.message ?? err}`,
      })
      console.log(`${tag} — error: ${err.message ?? err}`)
    }
    // Small pause — most are small charity sites.
    await sleep(400)
  }

  writeFileSync(FOUND_PATH, JSON.stringify(found, null, 2), 'utf8')
  writeFileSync(FAILED_PATH, JSON.stringify(failed, null, 2), 'utf8')
  console.log('')
  console.log(`✓ Found:  ${found.length}  → ${FOUND_PATH}`)
  console.log(`✗ Failed: ${failed.length} → ${FAILED_PATH}`)
  console.log('')
  console.log('Review found.json (especially low-rank emails), then --apply.')
}

async function apply() {
  const found = JSON.parse(readFileSync(FOUND_PATH, 'utf8'))
  console.log(`Applying ${found.length} emails…`)

  let applied = 0
  let skipped = 0
  let failed = 0

  for (const m of found) {
    // Re-check: skip if email was set in the meantime.
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${m.id}&select=contact_email`, { headers })
    const [row] = await checkRes.json()
    if (row?.contact_email) {
      skipped++
      console.log(`SKIP ${m.name} — already has ${row.contact_email}`)
      continue
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${m.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ contact_email: m.email }),
    })
    if (!res.ok) {
      failed++
      console.log(`FAIL ${m.name} — ${res.status} ${await res.text()}`)
      continue
    }
    applied++
    console.log(`OK   ${m.name} → ${m.email}`)
  }

  console.log('')
  console.log(`Applied: ${applied}  Skipped: ${skipped}  Failed: ${failed}`)
}

if (APPLY) await apply()
else await scrape()
