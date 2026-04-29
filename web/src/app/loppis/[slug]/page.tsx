import { notFound } from 'next/navigation'
import { permanentRedirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServerData } from '@fyndstigen/shared'
import { MarketDetail } from '@/components/market-detail'
import { TrackMarketView } from '@/components/track-market-view'

type Props = { params: Promise<{ slug: string }> }

export default async function LoppisPage({ params }: Props) {
  const { slug } = await params
  // Cookie-aware client so the logged-in organizer can reach their own
  // unpublished draft. Anon visitors still only resolve published
  // markets via RLS — same policy gates the visibility either way.
  const supabase = await createSupabaseServerClient()
  const id = await createSupabaseServerData(supabase).getMarketIdBySlug(slug)
  if (!id) {
    // Check slug history — the market may have been renamed. If we find a
    // match, permanentRedirect to the current slug (Next.js sends HTTP 308;
    // Google treats 308 == 301 for ranking purposes).
    const { data: hist } = await supabase
      .from('flea_market_slug_history')
      .select('flea_market_id, flea_markets!inner(slug)')
      .eq('old_slug', slug)
      .maybeSingle()
    const fm = hist?.flea_markets
    const currentSlug = (Array.isArray(fm) ? fm[0]?.slug : (fm as { slug: string } | null | undefined)?.slug) as string | undefined
    if (currentSlug) {
      permanentRedirect(`/loppis/${currentSlug}`)
    }
    notFound()
  }
  return (
    <>
      <TrackMarketView marketId={id} slug={slug} />
      <MarketDetail id={id} />
    </>
  )
}
