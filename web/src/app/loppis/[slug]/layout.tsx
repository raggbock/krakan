import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServerData } from '@fyndstigen/shared'

type Props = {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

// Use the cookie-aware server client so RLS sees the logged-in
// organizer's auth.uid() and lets them resolve their OWN drafts.
// Anon visitors still only see published markets via RLS — exactly
// what we want.
async function getServerData() {
  return createSupabaseServerData(await createSupabaseServerClient())
}

// React's cache() dedupes within a single request — both generateMetadata
// and the layout body resolve the same slug, but only one DB round-trip
// goes out. Without this we'd hit Supabase twice per render.
const resolveBySlug = cache(async (slug: string) => {
  const server = await getServerData()
  const id = await server.getMarketIdBySlug(slug)
  if (!id) return null
  const meta = await server.getMarketMeta(id)
  return meta ? { id, ...meta } : null
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const market = await resolveBySlug(slug)
  if (!market) {
    return { title: 'Loppis hittades inte' }
  }

  const isPremium = market.organizer_subscription_tier >= 1
  const title = market.name

  let description: string
  if (market.description) {
    description = market.description.slice(0, 160)
  } else if (isPremium && market.price_range) {
    description = `${market.name} i ${market.city}. ${market.is_permanent ? 'Permanent' : 'Tillfällig'} loppis. Bord från ${market.price_range.min_sek} kr. Hitta öppettider och boka bord på Fyndstigen.`
  } else {
    description = `${market.name} i ${market.city}. Hitta öppettider, adress och boka bord på Fyndstigen.`
  }

  // Drafts are reachable by URL (so owners can preview their work-in-progress
  // and the post-create redirect doesn't 404), but Google must not index
  // them — half-finished pages would tank the SEO equity of the eventual
  // published version.
  const isDraft = !market.published_at

  return {
    title,
    description,
    alternates: { canonical: `/loppis/${slug}` },
    ...(isDraft ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${market.name} — Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
      ...(market.image_url ? { images: [{ url: market.image_url }] } : {}),
    },
  }
}

export default async function LoppisLayout({ params, children }: Props) {
  const { slug } = await params
  const market = await resolveBySlug(slug)
  if (!market) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: market.name,
    description: market.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: market.street,
      postalCode: market.zip_code,
      addressLocality: market.city,
      addressCountry: 'SE',
    },
    ...(market.latitude && market.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: market.latitude,
            longitude: market.longitude,
          },
        }
      : {}),
    url: `https://fyndstigen.se/loppis/${slug}`,
    ...(market.opening_hour_rules.length > 0
      ? {
          openingHoursSpecification: market.opening_hour_rules
            .filter((r) => r.type !== 'biweekly')
            .map((r) => ({
              '@type': 'OpeningHoursSpecification',
              ...(r.type === 'weekly' && r.day_of_week !== null
                ? { dayOfWeek: SCHEMA_DAYS[r.day_of_week] }
                : {}),
              ...(r.type === 'date' && r.anchor_date
                ? { validFrom: r.anchor_date, validThrough: r.anchor_date }
                : {}),
              opens: r.open_time.slice(0, 5),
              closes: r.close_time.slice(0, 5),
            })),
        }
      : {}),
    ...(market.price_range
      ? { priceRange: `${market.price_range.min_sek}-${market.price_range.max_sek} SEK` }
      : {}),
    ...(market.image_url ? { image: market.image_url } : {}),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/search' },
      { '@type': 'ListItem', position: 3, name: market.city, item: `https://fyndstigen.se/search?city=${encodeURIComponent(market.city)}` },
      { '@type': 'ListItem', position: 4, name: market.name },
    ],
  }

  // One Event per upcoming dated opening rule. Permanent markets and
  // weekly recurring hours stay on LocalBusiness/OpeningHoursSpecification
  // — Google's Event rich results expect a concrete future date.
  const todayIso = new Date().toISOString().slice(0, 10)
  const eventLds = market.opening_hour_rules
    .filter((r) => r.type === 'date' && r.anchor_date && r.anchor_date >= todayIso)
    .map((r) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${market.name} — ${r.anchor_date}`,
      startDate: `${r.anchor_date}T${r.open_time.slice(0, 5)}`,
      endDate: `${r.anchor_date}T${r.close_time.slice(0, 5)}`,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: market.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: market.street,
          postalCode: market.zip_code,
          addressLocality: market.city,
          addressCountry: 'SE',
        },
        ...(market.latitude && market.longitude
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: market.latitude,
                longitude: market.longitude,
              },
            }
          : {}),
      },
      organizer: {
        '@type': 'Organization',
        name: 'Fyndstigen',
        url: 'https://fyndstigen.se',
      },
      url: `https://fyndstigen.se/loppis/${slug}`,
      ...(market.description ? { description: market.description.slice(0, 500) } : {}),
      ...(market.image_url ? { image: market.image_url } : {}),
      ...(market.price_range
        ? {
            offers: {
              '@type': 'Offer',
              price: market.price_range.min_sek,
              priceCurrency: 'SEK',
              availability: 'https://schema.org/InStock',
              url: `https://fyndstigen.se/loppis/${slug}`,
            },
          }
        : {}),
    }))

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />
      {eventLds.map((ev, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ev).replace(/</g, '\\u003c') }}
        />
      ))}
      {children}
    </>
  )
}
