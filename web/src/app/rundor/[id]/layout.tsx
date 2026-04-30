import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData } from '@fyndstigen/shared'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

function getServerData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  return createSupabaseServerData(supabase)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const route = await getServerData().getRouteMeta(id)
  if (!route) {
    return { title: 'Rundan hittades inte' }
  }

  const description = route.description
    ? route.description.slice(0, 160)
    : `Loppisrunda med ${route.stopCount} stopp. Planera din second hand-tur med Fyndstigen.`

  return {
    title: route.name,
    description,
    alternates: { canonical: `/rundor/${id}` },
    openGraph: {
      title: `${route.name} — Loppisrunda på Fyndstigen`,
      description,
      type: 'website',
      locale: 'sv_SE',
    },
  }
}

export default async function RouteLayout({ params, children }: Props) {
  const { id } = await params
  const route = await getServerData().getRouteMeta(id)
  if (!route) return <>{children}</>

  const description = route.description
    ? route.description.slice(0, 500)
    : `Loppisrunda med ${route.stopCount} stopp.`

  const tripLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: route.name,
    description,
    url: `https://fyndstigen.se/rundor/${id}`,
    touristType: 'Loppisåkare',
    provider: {
      '@type': 'Organization',
      name: 'Fyndstigen',
      url: 'https://fyndstigen.se',
    },
    ...(route.stops.length > 0
      ? {
          itinerary: {
            '@type': 'ItemList',
            numberOfItems: route.stops.length,
            itemListElement: route.stops.map((s) => ({
              '@type': 'ListItem',
              position: s.position + 1,
              item: {
                '@type': 'TouristAttraction',
                name: s.marketName,
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: s.city,
                  addressCountry: 'SE',
                },
                ...(s.latitude && s.longitude
                  ? {
                      geo: {
                        '@type': 'GeoCoordinates',
                        latitude: s.latitude,
                        longitude: s.longitude,
                      },
                    }
                  : {}),
                ...(s.marketSlug
                  ? { url: `https://fyndstigen.se/loppis/${s.marketSlug}` }
                  : {}),
              },
            })),
          },
        }
      : {}),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisrundor', item: 'https://fyndstigen.se/rundor' },
      { '@type': 'ListItem', position: 3, name: route.name },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tripLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />
      {children}
    </>
  )
}
