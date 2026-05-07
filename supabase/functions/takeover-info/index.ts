import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
import {
  TakeoverInfoInput,
  TakeoverInfoOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type HandleTakeoverInfoDeps = {
  admin: SupabaseClient
  input: { token: string }
}

type TakeoverInfoResult = {
  name: string
  city: string | null
  region: string | null
  sourceUrl: string | null
  maskedEmail: string | null
  marketId: string
}

// Module-scope cache: Supabase edge isolates are reused aggressively, so
// this gives meaningful hit rates. Tokens are stable until status changes
// (avg 894ms, p95 1.95s without cache → effectively 0ms on a hit).
// Soft cap of 10 000 entries prevents unbounded growth in long-lived isolates.
const tokenCache = new Map<string, { result: TakeoverInfoResult; expiresAt: number }>()
const TTL_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX = 10_000
const EVICT_COUNT = 1_000

export async function handleTakeoverInfo(deps: HandleTakeoverInfoDeps): Promise<TakeoverInfoResult> {
  const { admin, input } = deps

  const cached = tokenCache.get(input.token)
  if (cached && cached.expiresAt > Date.now()) return cached.result

  const tokenRow = await validateTakeoverToken(admin, input.token, { stampClickedAt: true })

  const { data: market, error: mErr } = await admin
    .from('flea_markets')
    .select('name, city, region, contact_website, is_deleted')
    .eq('id', tokenRow.flea_market_id)
    .single()
  if (mErr) throw new Error(mErr.message)
  if (market.is_deleted) throw new HttpError(410, 'market_removed')

  const result: TakeoverInfoResult = {
    name: market.name as string,
    city: (market.city as string | null) ?? null,
    region: (market.region as string | null) ?? null,
    sourceUrl: (market.contact_website as string | null) ?? null,
    maskedEmail: maskEmail(tokenRow.sent_to_email),
    marketId: tokenRow.flea_market_id,
  }

  tokenCache.set(input.token, { result, expiresAt: Date.now() + TTL_MS })

  // Evict oldest entries when the cache grows too large.
  if (tokenCache.size > CACHE_MAX) {
    const toEvict = [...tokenCache.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
      .slice(0, EVICT_COUNT)
    for (const [k] of toEvict) tokenCache.delete(k)
  }

  return result
}

definePublicEndpoint({
  name: 'takeover-info',
  input: TakeoverInfoInput,
  output: TakeoverInfoOutput,
  handler: ({ admin }, input) => handleTakeoverInfo({ admin, input }),
})

/**
 * Mask the local part of an email so visitors can recognise their own
 * inbox without us echoing the whole address back. "info@andrachansen.com"
 * → "i••@andrachansen.com". Returns null if input is null/empty/malformed.
 *
 * Hides the local-part length too — always two dots regardless of how
 * long the original was — so an attacker can't probe length variations.
 */
function maskEmail(email: string | null): string | null {
  if (!email) return null
  const at = email.indexOf('@')
  if (at <= 0) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!domain.includes('.')) return null
  return `${local[0]}••@${domain}`
}
