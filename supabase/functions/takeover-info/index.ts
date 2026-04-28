import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { validateTakeoverToken } from '../_shared/takeover-token.ts'
import {
  TakeoverInfoInput,
  TakeoverInfoOutput,
} from '@fyndstigen/shared/contracts/takeover.ts'

definePublicEndpoint({
  name: 'takeover-info',
  input: TakeoverInfoInput,
  output: TakeoverInfoOutput,
  handler: async ({ admin }, input) => {
    const tokenRow = await validateTakeoverToken(admin, input.token, { stampClickedAt: true })

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
      maskedEmail: maskEmail(tokenRow.sent_to_email),
      marketId: tokenRow.flea_market_id,
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
