import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

function getServerData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  return createSupabaseServerData(supabase)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const market = await getServerData().getMarketMeta(id)
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

  return {
    title,
    description,
    alternates: { canonical: `/fleamarkets/${id}` },
    openGraph: {
      title: `${market.name} — Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
      ...(market.image_url ? { images: [{ url: market.image_url }] } : {}),
    },
  }
}

export default async function FleaMarketLayout({ params, children }: Props) {
  const { id } = await params
  const market = await getServerData().getMarketMeta(id)

  const jsonLd = market
    ? {
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
        url: `https://fyndstigen.se/fleamarkets/${id}`,
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
    : null

  const breadcrumbLd = market
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
          { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/search' },
          { '@type': 'ListItem', position: 3, name: market.city, item: `https://fyndstigen.se/search?city=${encodeURIComponent(market.city)}` },
          { '@type': 'ListItem', position: 4, name: market.name },
        ],
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      {breadcrumbLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
        />
      )}
      {children}
    </>
  )
}
