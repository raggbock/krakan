import type { Metadata } from 'next'
import { resolveRoute } from './route-cache'

type Props = {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  // Shares the same React cache() instance as RouteLayout and page.tsx —
  // one DB round-trip per id per request.
  const route = await resolveRoute(id)
  if (!route) {
    return { title: 'Rundan hittades inte' }
  }

  const stopCount = route.stops.length
  const description = route.description
    ? route.description.slice(0, 160)
    : `Loppisrunda med ${stopCount} stopp. Planera din second hand-tur med Fyndstigen.`

  return {
    title: route.name,
    description,
    alternates: { canonical: `/rundor/${id}` },
    // Unpublished routes are creator-only previews (RLS); don't index.
    ...(route.isPublished ? {} : { robots: { index: false, follow: false } }),
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
  // Shares the same React cache() instance as generateMetadata and page.tsx —
  // one DB round-trip per id per request.
  const route = await resolveRoute(id)
  if (!route) return <>{children}</>

  // Unpublished routes are organizer-only previews (RLS lets the creator
  // see their own drafts via cookie auth). Skip JSON-LD so no structured
  // data for unpublished routes ends up in the HTML body.
  if (!route.isPublished) {
    return <>{children}</>
  }

  const stopCount = route.stops.length
  const description = route.description
    ? route.description.slice(0, 500)
    : `Loppisrunda med ${stopCount} stopp.`

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
              position: s.sortOrder + 1,
              item: {
                '@type': 'TouristAttraction',
                name: s.fleaMarket?.name,
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: s.fleaMarket?.city,
                  addressCountry: 'SE',
                },
                ...(s.fleaMarket?.latitude && s.fleaMarket?.longitude
                  ? {
                      geo: {
                        '@type': 'GeoCoordinates',
                        latitude: s.fleaMarket.latitude,
                        longitude: s.fleaMarket.longitude,
                      },
                    }
                  : {}),
                ...(s.fleaMarket?.slug
                  ? { url: `https://fyndstigen.se/loppis/${s.fleaMarket.slug}` }
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
