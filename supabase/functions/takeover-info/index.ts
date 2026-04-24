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
      .select('flea_market_id, used_at, invalidated_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!tokenRow) throw new HttpError(404, 'token_not_found')
    if (tokenRow.used_at) throw new HttpError(410, 'token_already_used')
    if (tokenRow.invalidated_at) throw new HttpError(410, 'token_invalidated')
    if (Date.parse(tokenRow.expires_at) < Date.now()) throw new HttpError(410, 'token_expired')

    const { data: market, error: mErr } = await admin
      .from('flea_markets')
      .select('name, city, region')
      .eq('id', tokenRow.flea_market_id)
      .single()
    if (mErr) throw new Error(mErr.message)

    return {
      name: market.name as string,
      city: (market.city as string | null) ?? null,
      region: (market.region as string | null) ?? null,
    }
  },
})
