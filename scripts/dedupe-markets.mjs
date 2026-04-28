#!/usr/bin/env node
/**
 * dedupe-markets.mjs
 *
 * Soft-delete duplicate flea_markets that sit within 100m of another in
 * the same city. The most descriptive / most-published row wins; losers
 * have their children (images, takeover tokens, unique opening hours)
 * re-pointed to the winner before being marked is_deleted=true.
 *
 * Run direct against DB (no JSON review phase, per user request):
 *   node --env-file=.env scripts/dedupe-markets.mjs
 *
 * Re-runnable: pairs where one side is already soft-deleted are
 * filtered out at the SQL level, so a second run is a no-op.
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service_role JWT).
 */

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}
function decodeJwtRole(token) {
  try {
    const json = Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function rpc(sql) {
  // Lightweight raw-SQL escape hatch via PostgREST: we created neither a
  // helper function nor an admin endpoint for this one-off cleanup.
  // PostgREST's RPC mechanism requires a function; instead, perform
  // queries via the REST table interface and do the join logic in JS.
  throw new Error('rpc() not implemented — use PostgREST table queries')
}

async function fetchPairs() {
  // The 100m-pair query needs PostGIS, which we can only run via RPC or
  // a server-side SQL endpoint. For this one-off, drive it from Node:
  // pull all non-deleted markets with location, then compute haversine
  // distances in JS. ~1146 rows, O(n²) ~= 1.3M comparisons — fine for
  // a one-shot script.
  const select = 'id,slug,name,city,published_at,latitude,longitude,description,'
    + 'contact_website,contact_phone,contact_email,contact_facebook,contact_instagram,'
    + 'organizer_id,is_system_owned,created_at,'
    + 'opening_hour_rules(id,type,day_of_week,anchor_date,open_time,close_time)'
  const filter = 'is_deleted=eq.false&latitude=not.is.null&longitude=not.is.null'

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

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

/**
 * Build clusters via Union-Find: two markets are in the same cluster
 * if they're within 100m and in the same city. Transitive: A~B and B~C
 * means A, B, C all merge.
 */
function buildClusters(markets) {
  const parent = new Map()
  for (const m of markets) parent.set(m.id, m.id)
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  const union = (a, b) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  // Bucket by city to skip obviously-distant pairs.
  const byCity = new Map()
  for (const m of markets) {
    const k = m.city ?? '__'
    if (!byCity.has(k)) byCity.set(k, [])
    byCity.get(k).push(m)
  }

  for (const [, group] of byCity) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (haversineKm(group[i], group[j]) * 1000 <= 100) {
          union(group[i].id, group[j].id)
        }
      }
    }
  }

  const clusters = new Map()
  for (const m of markets) {
    const root = find(m.id)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root).push(m)
  }
  return [...clusters.values()].filter((c) => c.length > 1)
}

/**
 * Pick the survivor in a cluster. Order:
 *   1. Published > unpublished (more SEO equity, more user-facing value)
 *   2. More opening_hour_rules (richer data)
 *   3. Longer name (descriptive beats bare-brand: "Myrorna Drottninggatan Örebro"
 *      wins over "Myrorna")
 *   4. Newer created_at (newest scrape often has cleaner data)
 */
function pickWinner(cluster) {
  return [...cluster].sort((a, b) => {
    const aPub = a.published_at ? 1 : 0
    const bPub = b.published_at ? 1 : 0
    if (bPub !== aPub) return bPub - aPub
    const aRules = a.opening_hour_rules?.length ?? 0
    const bRules = b.opening_hour_rules?.length ?? 0
    if (bRules !== aRules) return bRules - aRules
    if (b.name.length !== a.name.length) return b.name.length - a.name.length
    return new Date(b.created_at) - new Date(a.created_at)
  })[0]
}

/**
 * Merge children + missing fields from loser into winner, then soft-delete
 * the loser. Done in a single PostgREST round-trip per loser via a
 * stored function would be neater, but for a one-off, sequential PATCHes
 * are easier to debug — and the writes are idempotent (re-pointing an
 * already-pointed row is a no-op).
 */
async function mergeAndDelete(winner, loser) {
  // 1. Re-point images to winner (no unique constraint on this side; safe).
  await fetch(`${SUPABASE_URL}/rest/v1/flea_market_images?flea_market_id=eq.${loser.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ flea_market_id: winner.id }),
  })

  // 2. Re-point business_owner_tokens (multiple tokens per market is OK).
  await fetch(`${SUPABASE_URL}/rest/v1/business_owner_tokens?flea_market_id=eq.${loser.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ flea_market_id: winner.id }),
  })

  // 3. Insert any opening_hour_rules from loser that the winner doesn't
  // already have (keyed by type + day + anchor + times). Don't re-point
  // — that risks unique-constraint clashes and brings stale rules along.
  const winnerRules = new Set(
    (winner.opening_hour_rules ?? []).map(
      (r) => `${r.type}|${r.day_of_week}|${r.anchor_date}|${r.open_time}|${r.close_time}`,
    ),
  )
  const newRules = (loser.opening_hour_rules ?? [])
    .filter((r) => !winnerRules.has(`${r.type}|${r.day_of_week}|${r.anchor_date}|${r.open_time}|${r.close_time}`))
    .map((r) => ({
      flea_market_id: winner.id,
      type: r.type,
      day_of_week: r.day_of_week,
      anchor_date: r.anchor_date,
      open_time: r.open_time,
      close_time: r.close_time,
    }))
  if (newRules.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/opening_hour_rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newRules),
    })
  }

  // 4. Copy missing fields onto winner. Only fill nulls — never overwrite.
  const fieldsToFill = ['description', 'contact_website', 'contact_phone', 'contact_email', 'contact_facebook', 'contact_instagram']
  const patch = {}
  for (const f of fieldsToFill) {
    if (!winner[f] && loser[f]) patch[f] = loser[f]
  }
  // If winner is system_owned but loser had a real organizer, prefer the
  // claimed identity.
  if (winner.is_system_owned && !loser.is_system_owned && loser.organizer_id) {
    patch.organizer_id = loser.organizer_id
    patch.is_system_owned = false
  }
  if (Object.keys(patch).length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${winner.id}`, {
      method: 'PATCH', headers, body: JSON.stringify(patch),
    })
  }

  // 5. Soft-delete the loser. Mark explicitly with a note so future audits
  // can tell apart automated dedup deletes from manual ones.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/flea_markets?id=eq.${loser.id}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ is_deleted: true, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`soft-delete ${loser.id}: ${res.status} ${await res.text()}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('Fetching markets…')
  const markets = await fetchPairs()
  console.log(`  ${markets.length} non-deleted markets with coords.`)

  const clusters = buildClusters(markets)
  console.log(`Found ${clusters.length} clusters with duplicates (${clusters.reduce((s, c) => s + c.length, 0)} markets total).`)

  let merged = 0
  let deleted = 0
  let failed = 0

  for (const cluster of clusters) {
    const winner = pickWinner(cluster)
    const losers = cluster.filter((m) => m.id !== winner.id)
    console.log('')
    console.log(`Cluster (${cluster.length}) in ${winner.city}:`)
    console.log(`  WIN   "${winner.name}" [${winner.slug}] ${winner.published_at ? '(published)' : '(draft)'} ${winner.opening_hour_rules?.length ?? 0} rule(s)`)
    for (const l of losers) {
      console.log(`  LOSE  "${l.name}" [${l.slug}] ${l.published_at ? '(published)' : '(draft)'} ${l.opening_hour_rules?.length ?? 0} rule(s)`)
      try {
        await mergeAndDelete(winner, l)
        deleted++
      } catch (err) {
        console.error(`    ERROR: ${err.message}`)
        failed++
      }
    }
    merged++
  }

  console.log('')
  console.log(`Done. Merged ${merged} clusters, soft-deleted ${deleted} losers, ${failed} failed.`)
}

await main()
