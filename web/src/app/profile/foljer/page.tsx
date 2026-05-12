import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { FoljerClient, type FollowedMarket, type FollowedCity } from './foljer-client'

export const metadata: Metadata = {
  title: 'Mina följda – Fyndstigen',
}

export default async function FoljerPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth?next=/profile/foljer')
  }

  // ── Fetch followed markets with display data ──────────────────────────────
  // Join user_market_follows → flea_markets to get name + slug in one query.
  const { data: marketRows } = await supabase
    .from('user_market_follows')
    .select('flea_market_id, flea_markets!inner(name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const markets: FollowedMarket[] = (marketRows ?? []).flatMap((row) => {
    const fm = row.flea_markets as unknown as { name: string; slug: string } | null
    if (!fm) return []
    return [{ id: row.flea_market_id, name: fm.name, slug: fm.slug }]
  })

  // ── Fetch followed cities ─────────────────────────────────────────────────
  const { data: cityRows } = await supabase
    .from('user_city_follows')
    .select('city_slug')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Derive canonical display name from slug: "stor-stad" → "Stor-stad"
  // We use the raw slug as a best-effort label. If canonical city names are
  // needed, join against flea_markets — but slug is human-readable enough.
  const cities: FollowedCity[] = (cityRows ?? []).map((row) => ({
    slug: row.city_slug,
    displayName: row.city_slug
      .split('-')
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
  }))

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <FoljerClient userId={user.id} markets={markets} cities={cities} />
    </div>
  )
}
