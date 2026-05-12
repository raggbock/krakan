import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
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

// Raw row returned by visible_flea_markets (snake_case DB columns)
type VisibleMarketRow = {
  id: string
  name: string
  description: string | null
  street: string | null
  zip_code: string | null
  city: string | null
  country: string | null
  is_permanent: boolean
  latitude: number | null
  longitude: number | null
  published_at: string | null
  organizer_id: string | null
  auto_accept_bookings: boolean | null
  created_at: string | null
  slug: string | null
  is_system_owned: boolean | null
  contact_website: string | null
  contact_phone: string | null
  contact_email: string | null
  google_place_id: string | null
}

function mapRow(row: VisibleMarketRow): FleaMarketView {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    street: row.street ?? '',
    zipCode: row.zip_code ?? '',
    city: row.city ?? '',
    country: row.country ?? '',
    isPermanent: row.is_permanent ?? false,
    latitude: row.latitude ?? 0,
    longitude: row.longitude ?? 0,
    publishedAt: row.published_at ?? null,
    organizerId: row.organizer_id ?? '',
    autoAcceptBookings: row.auto_accept_bookings ?? false,
    createdAt: row.created_at ?? '',
    slug: row.slug ?? null,
    isSystemOwned: row.is_system_owned ?? false,
    contactWebsite: row.contact_website ?? null,
    contactPhone: row.contact_phone ?? null,
    contactEmail: row.contact_email ?? null,
    googlePlaceId: row.google_place_id ?? null,
  }
}

async function getMarkets(page: number, pageSize: number): Promise<{ items: FleaMarketView[]; count: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count, error } = await supabase
    .from('visible_flea_markets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[utforska] failed to fetch markets for SSR:', error.message)
    return { items: [], count: 0 }
  }

  const items = (data as VisibleMarketRow[] ?? []).map(mapRow)
  return { items, count: count ?? 0 }
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
