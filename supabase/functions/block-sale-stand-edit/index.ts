import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  BlockSaleStandEditInput,
  BlockSaleStandEditOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-edit.ts'
import { verifyEditToken } from '../_shared/block-sale-tokens.ts'
import { geocodeAddress } from '../_shared/geocode.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { z } from 'zod'

export type HandleBlockSaleStandEditDeps = {
  admin: SupabaseClient
  input: z.infer<typeof BlockSaleStandEditInput>
  verifyToken?: typeof verifyEditToken
  geocode?: typeof geocodeAddress
}

export async function handleBlockSaleStandEdit(
  deps: HandleBlockSaleStandEditDeps,
): Promise<{ ok: true }> {
  const {
    admin,
    input,
    verifyToken = verifyEditToken,
    geocode = geocodeAddress,
  } = deps

  const payload = await verifyToken(input.token)
  if (!payload) throw new HttpError(400, 'invalid_token')

  const { data: stand } = await admin
    .from('block_sale_stands').select('id, status, city')
    .eq('id', payload.standId).maybeSingle()
  if (!stand) throw new HttpError(404, 'not_found')
  if (stand.status === 'rejected') throw new HttpError(403, 'forbidden')

  const patch: Record<string, unknown> = {}
  if (input.description !== undefined) patch.description = input.description
  if (input.street !== undefined) {
    patch.street = input.street
    const geo = await geocode(`${input.street}, ${stand.city}, Sweden`).catch(() => null)
    if (geo) patch.location = `POINT(${geo.lng} ${geo.lat})`
  }

  if (Object.keys(patch).length === 0) return { ok: true as const }
  const { error } = await admin.from('block_sale_stands').update(patch).eq('id', stand.id)
  if (error) throw new Error(error.message)
  return { ok: true as const }
}

definePublicEndpoint({
  name: 'block-sale-stand-edit',
  input: BlockSaleStandEditInput,
  output: BlockSaleStandEditOutput,
  handler: async ({ admin }, input) => {
    return handleBlockSaleStandEdit({ admin, input })
  },
})
