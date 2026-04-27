import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'
import { MarketDetail } from '@/components/market-detail'

type Props = { params: Promise<{ slug: string }> }

export default async function LoppisPage({ params }: Props) {
  const { slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  const id = await createSupabaseServerData(supabase).getMarketIdBySlug(slug)
  if (!id) notFound()
  return <MarketDetail id={id} />
}
