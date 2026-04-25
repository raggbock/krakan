#!/usr/bin/env node
/**
 * Create a takeover token for a flea market and print the URL.
 *
 * Lets you test the /takeover/[token] flow end-to-end without going
 * through /admin/takeover (which requires being logged in as admin and
 * mails the URL via Resend). The 6-digit verification code step still
 * mails — point the script at an inbox you own.
 *
 * Usage:
 *   node scripts/create-takeover-token.mjs --slug <slug> [--email you@example.com]
 *   node scripts/create-takeover-token.mjs --market-id <uuid> [--email ...]
 *
 * Env required (.env or shell):
 *   SUPABASE_URL                  — e.g. https://abc.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY     — service role JWT (NOT the anon key)
 *   WEB_URL                       — optional, defaults to http://localhost:3000
 */

import crypto from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const args = parseArgs(process.argv.slice(2))
if (!args.slug && !args['market-id']) {
  console.error('Pass --slug <slug> or --market-id <uuid>.')
  process.exit(1)
}

const headers = {
  apikey: SERVICE_KEY,
  authorization: `Bearer ${SERVICE_KEY}`,
  'content-type': 'application/json',
  prefer: 'return=representation',
}

const market = await findMarket()
const rawToken = crypto.randomBytes(32).toString('base64url')
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/business_owner_tokens`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    flea_market_id: market.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    sent_to_email: args.email ?? null,
  }),
})

if (!insertRes.ok) {
  console.error('Insert failed:', insertRes.status, await insertRes.text())
  process.exit(1)
}

const url = `${WEB_URL}/takeover/${rawToken}`
console.log()
console.log(`  Market:      ${market.name}  (${market.id})`)
console.log(`  Token hash:  ${tokenHash.slice(0, 16)}…`)
console.log(`  Expires:     ${expiresAt}`)
console.log(`  Sent-to:     ${args.email ?? '(none)'}`)
console.log()
console.log(`  ${url}`)
console.log()

async function findMarket() {
  const filter = args.slug
    ? `slug=eq.${encodeURIComponent(args.slug)}`
    : `id=eq.${encodeURIComponent(args['market-id'])}`
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/flea_markets?${filter}&select=id,name,slug&limit=1`,
    { headers },
  )
  if (!res.ok) {
    console.error('Lookup failed:', res.status, await res.text())
    process.exit(1)
  }
  const rows = await res.json()
  if (rows.length === 0) {
    console.error('No market matched.')
    process.exit(1)
  }
  return rows[0]
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    }
  }
  return out
}
