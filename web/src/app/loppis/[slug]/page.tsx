import { notFound } from 'next/navigation'
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
  if (!id) notFound()
  return (
    <>
      <TrackMarketView marketId={id} slug={slug} />
      <MarketDetail id={id} />
    </>
  )
}
