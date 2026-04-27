import { notFound, permanentRedirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'

// Legacy UUID URL — 308-redirects to the slug-based canonical /loppis/[slug].
// 308 (permanent) preserves SEO equity. Existing inbound links from before
// the slug migration will keep working but the response tells crawlers to
// move their index entry over.
//
// /fleamarkets/[id]/edit is unaffected — it has its own page.tsx in the
// child segment so this redirect never runs for the edit route.

type Props = { params: Promise<{ id: string }> }

export default async function FleaMarketRedirect({ params }: Props) {
  const { id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  const slug = await createSupabaseServerData(supabase).getMarketSlugById(id)
  if (!slug) notFound()
  permanentRedirect(`/loppis/${slug}`)
}
