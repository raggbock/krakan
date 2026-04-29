import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { slugifyCity } from '@fyndstigen/shared/format.ts'

function buildBaseSlug(name: string, city: string | null): string {
  return slugifyCity(`${name}-${city ?? ''}`).replace(/-+$/, '')
}

/**
 * Pick a unique slug for a market. Tries baseSlug first, then -2, -3...
 * up to 20 tries. Excludes excludeMarketId so a market can keep its
 * own slug if it happens to "collide" with itself.
 *
 * Checks both live flea_markets.slug and flea_market_slug_history.old_slug
 * so we never hand out a slug that would shadow a 301-redirect claim by
 * another market.
 */
export async function pickUniqueSlug(
  admin: SupabaseClient,
  name: string,
  city: string | null,
  excludeMarketId?: string,
): Promise<string> {
  const base = buildBaseSlug(name, city)
  const nullId = '00000000-0000-0000-0000-000000000000'
  const excludeId = excludeMarketId ?? nullId

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`

    // Live market with this slug (excluding self)?
    const { data: live, error: liveErr } = await admin
      .from('flea_markets')
      .select('id')
      .eq('slug', candidate)
      .neq('id', excludeId)
      .maybeSingle()
    if (liveErr) throw new Error(liveErr.message)
    if (live) continue

    // Historic slug claim by a different market?
    const { data: hist, error: histErr } = await admin
      .from('flea_market_slug_history')
      .select('flea_market_id')
      .eq('old_slug', candidate)
      .neq('flea_market_id', excludeId)
      .maybeSingle()
    if (histErr) throw new Error(histErr.message)
    if (hist) continue

    return candidate
  }
  throw new Error('Could not find unique slug after 20 tries')
}
