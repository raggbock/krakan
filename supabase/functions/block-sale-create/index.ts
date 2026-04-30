import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { generateBlockSaleSlug, validateBlockSaleInput } from '@fyndstigen/shared/block-sale.ts'
import {
  BlockSaleCreateInput,
  BlockSaleCreateOutput,
} from '@fyndstigen/shared/contracts/block-sale-create.ts'
import { geocodeAddress } from '../_shared/geocode.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { z } from 'zod'

export type HandleBlockSaleCreateDeps = {
  admin: SupabaseClient
  userId: string
  input: z.infer<typeof BlockSaleCreateInput>
  geocode?: typeof geocodeAddress
}

export async function handleBlockSaleCreate(
  deps: HandleBlockSaleCreateDeps,
): Promise<{ ok: true; slug: string }> {
  const { admin, userId, input, geocode = geocodeAddress } = deps

  const v = validateBlockSaleInput(input)
  if (!v.ok) throw new HttpError(400, v.reason)

  const base = generateBlockSaleSlug(input.name, input.city, input.startDate)
  const slug = await pickUniqueBlockSaleSlug(admin, base)

  let center: { lat: number; lng: number } | null = null
  if (input.street) {
    center = await geocode(`${input.street}, ${input.city}, Sweden`).catch(() => null)
  }

  const row: Record<string, unknown> = {
    organizer_id: userId,
    name: input.name,
    slug,
    description: input.description ?? null,
    start_date: input.startDate,
    end_date: input.endDate,
    daily_open: input.dailyOpen,
    daily_close: input.dailyClose,
    city: input.city,
    region: input.region ?? null,
    published_at: input.publish ? new Date().toISOString() : null,
  }
  if (center) row.center_location = `POINT(${center.lng} ${center.lat})`

  const { error } = await admin.from('block_sales').insert(row)
  if (error) throw new Error(error.message)

  return { ok: true as const, slug }
}

defineEndpoint({
  name: 'block-sale-create',
  input: BlockSaleCreateInput,
  output: BlockSaleCreateOutput,
  handler: ({ admin, user }, input) =>
    handleBlockSaleCreate({ admin, userId: user.id, input }),
})

async function pickUniqueBlockSaleSlug(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`.slice(0, 80)
    const { data, error } = await admin
      .from('block_sales')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return candidate
  }
  throw new Error('Could not find unique slug after 20 tries')
}
