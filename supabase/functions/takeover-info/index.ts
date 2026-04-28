import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sha256Hex } from '../_shared/takeover-helpers.ts'
import {
  TakeoverInfoInput,
  TakeoverInfoOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

definePublicEndpoint({
  name: 'takeover-info',
  input: TakeoverInfoInput,
  output: TakeoverInfoOutput,
  handler: async ({ admin }, input) => {
    const tokenHash = await sha256Hex(input.token)
    const { data: tokenRow, error } = await admin
      .from('business_owner_tokens')
      .select('flea_market_id, used_at, invalidated_at, expires_at, sent_to_email')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('name, city, region, contact_website, is_deleted')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (mErr) throw new Error(mErr.message)
    if (market.is_deleted) throw new HttpError(410, 'market_removed')

    return {
      name: market.name as string,
      city: (market.city as string | null) ?? null,
      region: (market.region as string | null) ?? null,
      sourceUrl: (market.contact_website as string | null) ?? null,
      maskedEmail: maskEmail((tokenRow.sent_to_email as string | null) ?? null),
    }
  },
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
