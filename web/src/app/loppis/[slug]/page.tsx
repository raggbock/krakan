import { notFound, permanentRedirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { TrackMarketView } from '@/components/track-market-view'
import { MarketDetail } from '@/components/market/detail'
import { resolveMarketDetails } from './market-cache'

type Props = { params: Promise<{ slug: string }> }

export default async function LoppisPage({ params }: Props) {
  const { slug } = await params

  // E2E bypass — server-side Supabase isn't available under the in-memory
  // bridge, so treat slug as id and let the client resolve via deps.
  if (process.env.NEXT_PUBLIC_E2E_FAKE === '1') {
    return (
      <>
        <TrackMarketView marketId={slug} slug={slug} />
        <MarketDetail id={slug} market={null} tables={[]} />
      </>
    )
  }

  const data = await resolveMarketDetails(slug)

  if (!data) {
    // Check slug history — the market may have been renamed. If we find a
    // match, permanentRedirect to the current slug (Next.js sends HTTP 308;
    // Google treats 308 == 301 for ranking purposes).
    const supabase = await createSupabaseServerClient()
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
      <TrackMarketView marketId={data.id} slug={slug} />
      <MarketDetail id={data.id} market={data.market} tables={data.tables} />
    </>
  )
}
