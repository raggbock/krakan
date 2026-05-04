import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'
import { expandEventDates } from '@fyndstigen/shared/block-sale'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// ISR: revalidate every hour — kvartersloppis pages are stable once published.
export const revalidate = 3600

export async function generateStaticParams() {
  // Pre-render all currently-published kvartersloppis at build time.
  // Low volume initially; ISR (revalidate = 3600) handles any new ones.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  const server = createSupabaseServerData(sb)
  const blockSales = await server.listPublishedBlockSaleIds()
  return blockSales.map((bs) => ({ slug: bs.slug }))
}

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode }

const resolve = cache(async (slug: string) => {
  const sb = await createSupabaseServerClient()
  const port = createSupabaseServerData(sb)
  const id = await port.getBlockSaleIdBySlug(slug)
  if (!id) return null
  const meta = await port.getBlockSaleMeta(id)
  return meta ? { id, ...meta } : null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const bs = await resolve(slug)
  if (!bs) return { title: 'Kvartersloppis hittades inte' }
  const isDraft = !bs.publishedAt
  const dateLabel = bs.endDate !== bs.startDate ? `${bs.startDate}–${bs.endDate}` : bs.startDate
  return {
    title: `${bs.name} — Kvartersloppis i ${bs.city}`,
    description: bs.description?.slice(0, 160) ?? `Kvartersloppis ${dateLabel} i ${bs.city}.`,
    alternates: { canonical: `/kvartersloppis/${slug}` },
    ...(isDraft ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function Layout({ params, children }: Props) {
  const { slug } = await params
  const bs = await resolve(slug)
  if (!bs) notFound()

  const dates = expandEventDates(bs.startDate, bs.endDate)
  const events = dates.map((d) => ({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: dates.length > 1 ? `${bs.name} (${d})` : bs.name,
    startDate: `${d}T${bs.dailyOpen}`,
    endDate: `${d}T${bs.dailyClose}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: bs.name,
      address: { '@type': 'PostalAddress', addressLocality: bs.city, addressCountry: 'SE' },
      ...(bs.centerLatitude && bs.centerLongitude ? {
        geo: { '@type': 'GeoCoordinates', latitude: bs.centerLatitude, longitude: bs.centerLongitude },
      } : {}),
    },
    organizer: { '@type': 'Organization', name: 'Fyndstigen', url: 'https://fyndstigen.se' },
    url: `https://fyndstigen.se/kvartersloppis/${slug}`,
    ...(bs.description ? { description: bs.description.slice(0, 500) } : {}),
  }))

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Kvartersloppisar', item: 'https://fyndstigen.se/kvartersloppis' },
      { '@type': 'ListItem', position: 3, name: bs.city },
      { '@type': 'ListItem', position: 4, name: bs.name },
    ],
  }

  return (
    <>
      {events.map((e, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(e).replace(/</g, '\\u003c') }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }}
      />
      {children}
    </>
  )
}
