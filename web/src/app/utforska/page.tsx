import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseFleaMarkets } from '@fyndstigen/shared'
import type { FleaMarketView } from '@fyndstigen/shared'
import ExploreClient from './explore-client'

// ISR: revalidate every hour — market list changes infrequently.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Utforska loppisar — bläddra bland Sveriges loppisar',
  description:
    'Bläddra bland alla loppisar och loppmarknader i Sverige. Filtrera på öppet just nu, hitta loppisar nära dig och se öppettider — allt samlat på Fyndstigen.',
  alternates: { canonical: '/utforska' },
  openGraph: {
    title: 'Utforska loppisar — bläddra bland Sveriges loppisar',
    description:
      'Bläddra bland alla loppisar och loppmarknader i Sverige. Filtrera på öppet just nu, hitta loppisar nära dig och se öppettider — allt samlat på Fyndstigen.',
    type: 'website',
    locale: 'sv_SE',
  },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

async function getMarkets(page: number, pageSize: number): Promise<{ items: FleaMarketView[]; count: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  // CI runs without a real Supabase backend (placeholder env vars). A real
  // fetch would hang ~30s before timing out, blocking the Playwright nav
  // assertion. Bail fast and render an empty grid; client hydration with
  // real session env will refetch on the client.
  if (!url || !anon || url.includes('placeholder.supabase.co')) {
    return { items: [], count: 0 }
  }
  const supabase = createClient(url, anon)
  try {
    return await createSupabaseFleaMarkets(supabase).list({ page, pageSize })
  } catch (err) {
    console.error('[utforska] failed to fetch markets for SSR:', err instanceof Error ? err.message : err)
    return { items: [], count: 0 }
  }
}

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, parseInt(rawPage ?? '1', 10) || 1)
  const pageSize = 20

  const { items, count } = await getMarkets(page, pageSize)

  return (
    <ExploreClient
      initialMarkets={items}
      initialCount={count}
      initialPage={page}
    />
  )
}
