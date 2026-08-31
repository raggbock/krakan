#!/usr/bin/env node
/**
 * Applies Jobs 2 and 3 from the 2026-08-30 hours-audit cleanup against
 * production Supabase, driven by scripts/verify-hours-report.json (gitignored,
 * produced by scripts/verify-opening-hours.mjs).
 *
 * Job 1 (is_permanent backfill) is a single UPDATE with no JSON dependency —
 * run it directly via SQL, not from this script.
 *
 * Job 2: soft-delete markets Google reports CLOSED_PERMANENTLY.
 * Job 3: for DIFFERS + OPERATIONAL markets, replace opening_hour_rules with
 *   Google's current hours via replace_opening_hours_atomic(), then publish
 *   (published_at + is_permanent) markets that have a non-null street.
 *
 * Run:
 *   node --env-file=.env scripts/fix-hours-audit.mjs job2
 *   node --env-file=.env scripts/fix-hours-audit.mjs job3-test   # single market, no loop
 *   node --env-file=.env scripts/fix-hours-audit.mjs job3
 *
 * Env (.env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPORT_PATH = new URL('./verify-hours-report.json', import.meta.url)

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
}

function loadReport() {
  return JSON.parse(readFileSync(REPORT_PATH, 'utf8'))
}

async function patchMarket(id, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers, prefer: 'return=representation', ...extraHeaders },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    return { ok: false, status: res.status, message: await res.text() }
  }
  return { ok: true, rows: await res.json() }
}

async function job2() {
  const report = loadReport()
  const closed = report.filter((m) => m.businessStatus === 'CLOSED_PERMANENTLY')
  const tempClosed = report.filter((m) => m.businessStatus === 'CLOSED_TEMPORARILY')
  console.log(`CLOSED_PERMANENTLY: ${closed.length} (expect 33)`)
  console.log(`CLOSED_TEMPORARILY: ${tempClosed.length} (expect 14, left untouched)`)

  let softDeleted = 0
  let skipped = 0
  for (const m of closed) {
    // set is_deleted only; never touch published_at
    const result = await patchMarket(m.id, { is_deleted: true })
    if (!result.ok) {
      console.error(`FAILED id=${m.id} (${m.name}): ${result.status} ${result.message}`)
      skipped++
      continue
    }
    softDeleted++
  }
  console.log(`Soft-deleted: ${softDeleted}, failed: ${skipped}`)
  console.log('CLOSED_TEMPORARILY ids (verify untouched):', tempClosed.map((m) => m.id).join(','))
}

// Map a stored/google hour-row into the shape replace_opening_hours_atomic expects:
// { type, day_of_week, anchor_date, open_time, close_time }
function toRule(row) {
  return {
    type: 'weekly',
    day_of_week: row.day_of_week,
    anchor_date: null,
    open_time: row.open_time,
    close_time: row.close_time,
  }
}

async function replaceHours(marketId, googleRows) {
  const rules = googleRows.map(toRule)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/replace_opening_hours_atomic`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_market_id: marketId, p_rules: rules }),
  })
  if (!res.ok) {
    return { ok: false, status: res.status, message: await res.text() }
  }
  return { ok: true }
}

async function fetchRules(marketId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/opening_hour_rules?flea_market_id=eq.${marketId}&select=day_of_week,open_time,close_time,type&order=day_of_week`,
    { headers },
  )
  if (!res.ok) {
    console.error('fetchRules failed', res.status, await res.text())
    return []
  }
  return res.json()
}

function differsSet(report) {
  return report.filter((m) => m.bucket === 'DIFFERS' && m.businessStatus === 'OPERATIONAL')
}

async function job3Test() {
  const report = loadReport()
  const set = differsSet(report)
  const m = set[0]
  console.log(`Testing on market id=${m.id} name=${m.name}`)
  console.log('google rows:', JSON.stringify(m.google))
  const result = await replaceHours(m.id, m.google)
  if (!result.ok) {
    console.error('RPC FAILED', result.status, result.message)
    process.exit(1)
  }
  const rules = await fetchRules(m.id)
  console.log('rules now in DB:', JSON.stringify(rules, null, 2))
}

async function job3() {
  const report = loadReport()
  const set = differsSet(report)
  console.log(`DIFFERS + OPERATIONAL: ${set.length}`)

  let replaced = 0
  let replaceFailed = 0
  let published = 0
  let skippedNoStreet = 0
  const skippedIds = []

  for (const m of set) {
    const result = await replaceHours(m.id, m.google)
    if (!result.ok) {
      console.error(`RPC FAILED id=${m.id} (${m.name}): ${result.status} ${result.message}`)
      replaceFailed++
      continue
    }
    replaced++

    if (!m.street) {
      skippedNoStreet++
      skippedIds.push(m.id)
      continue
    }

    const pub = await patchMarket(m.id, { published_at: new Date().toISOString(), is_permanent: true })
    if (!pub.ok) {
      console.error(`PUBLISH FAILED id=${m.id} (${m.name}): ${pub.status} ${pub.message}`)
      continue
    }
    // rows: [] means the filter (is_deleted is not true and published_at is null) didn't match
    // (already published, or deleted) — not an error, just not newly published.
    if (Array.isArray(pub.rows) && pub.rows.length > 0) {
      published++
    }
  }

  console.log(`Replaced hours: ${replaced}, RPC failed: ${replaceFailed}`)
  console.log(`Published: ${published}, skipped (no street): ${skippedNoStreet}`)
  if (skippedIds.length) console.log('Skipped ids (no street):', skippedIds.join(','))
}

const mode = process.argv[2]
if (mode === 'job2') await job2()
else if (mode === 'job3-test') await job3Test()
else if (mode === 'job3') await job3()
else {
  console.error('Usage: node --env-file=.env scripts/fix-hours-audit.mjs <job2|job3-test|job3>')
  process.exit(1)
}
