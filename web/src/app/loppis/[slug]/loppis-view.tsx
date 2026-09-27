/**
 * Rendering for /loppis/[slug], shared by the two routes that serve it:
 *
 *   app/loppis/[slug]         — session-bound (cookies). Logged-in visitors,
 *                               so organizers can preview their drafts. Dynamic.
 *   app/loppis-publik/[slug]  — anonymous, ISR. middleware.ts rewrites every
 *                               request without a session here; the URL the
 *                               visitor and Google see stays /loppis/<slug>.
 *
 * Moved verbatim from the old layout.tsx/page.tsx; the only change is that the
 * data source is a parameter instead of the cookie-reading client.
 */
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { createGeo, slugifyCity } from '@fyndstigen/shared'
import type { FleaMarketNearByView } from '@fyndstigen/shared'
import { marketUrl } from '@/lib/urls'
import { TrackMarketView } from '@/components/track-market-view'
import { MarketDetail } from '@/components/market/detail'
import type { LoppisSource } from './market-cache'

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

async function getGeoService(source: LoppisSource) {
  return createGeo(await source.client())
}

// --- NearbyMarketsSection ---

function formatDistanceKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

function NearbyMarketsSection({ markets }: { markets: FleaMarketNearByView[] }) {
  return (
    <section
      className="max-w-4xl mx-auto px-6 pb-16"
      aria-label="Närliggande loppisar"
    >
      <h2 className="font-display text-2xl font-bold mb-6">Närliggande loppisar</h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {markets.map((m) => (
          <li key={m.id}>
            <Link
              href={marketUrl(m)}
              className="vintage-card flex flex-col gap-1.5 p-4 hover:bg-cream-warm/30 transition-colors group"
              aria-label={`${m.name} i ${m.city}, ${formatDistanceKm(m.distanceKm)} bort`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display font-bold group-hover:text-rust transition-colors line-clamp-2 flex-1">
                  {m.name}
                </span>
                <span
                  className={`stamp text-[10px] shrink-0 mt-0.5 ${
                    m.isPermanent ? 'text-forest' : 'text-mustard'
                  }`}
                >
                  {m.isPermanent ? 'Permanent' : 'Tillfällig'}
                </span>
              </div>
              <p className="text-sm text-espresso/75">{m.city}</p>
              <p className="text-xs text-espresso/45 mt-0.5">
                {formatDistanceKm(m.distanceKm)} bort
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function buildLoppisMetadata(slug: string, source: LoppisSource): Promise<Metadata> {
  if (process.env.NEXT_PUBLIC_E2E_FAKE === '1') {
    return { title: 'E2E loppis' }
  }
  // Shares the same React cache() instance as LoppisLayout and page.tsx —
  // one DB round-trip sequence per slug per request.
  const data = await source.resolve(slug)
  if (!data) {
    return { title: 'Loppis hittades inte' }
  }

  const { market, meta } = data
  const isPremium = meta.organizer_subscription_tier >= 1
  const title = `${market.name} — öppettider i ${market.city}`

  // Meta description doesn't render line breaks — flatten any newlines from
  // the seller's free-text description into single spaces so the snippet
  // doesn't look like it was written with stray whitespace.
  const flatDescription = market.description?.replace(/\s+/g, ' ').trim()
  let description: string
  if (flatDescription) {
    description = flatDescription.slice(0, 160)
  } else if (isPremium && meta.price_range) {
    description = `${market.name} i ${market.city}. ${market.isPermanent ? 'Permanent' : 'Tillfällig'} loppis. Bord från ${meta.price_range.min_sek} kr. Hitta öppettider och boka bord på Fyndstigen.`
  } else {
    description = `${market.name} i ${market.city}. Hitta öppettider, adress och boka bord på Fyndstigen.`
  }

  // Drafts are reachable by URL (so owners can preview their work-in-progress
  // and the post-create redirect doesn't 404), but Google must not index
  // them — half-finished pages would tank the SEO equity of the eventual
  // published version.
  const isDraft = !market.publishedAt

  const url = `/loppis/${slug}`
  const ogTitle = `${market.name} — öppettider i ${market.city}`
  const ogImages = meta.image_url
    ? [{ url: meta.image_url }]
    : [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }]
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(isDraft ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: ogTitle,
      description,
      type: 'website',
      locale: 'sv_SE',
      url,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [meta.image_url ?? '/logo-512.png'],
    },
  }
}

export async function LoppisLayoutView({
  slug,
  source,
  children,
}: {
  slug: string
  source: LoppisSource
  children: React.ReactNode
}) {

  // E2E bypass — skip the Supabase resolve + JSON-LD. The page handles the
  // slug-as-id fallback and renders MarketDetail from the in-memory bridge.
  if (process.env.NEXT_PUBLIC_E2E_FAKE === '1') {
    return <>{children}</>
  }

  // Shares the same React cache() instance as generateMetadata and page.tsx —
  // one DB round-trip sequence per slug per request.
  const data = await source.resolve(slug)
  if (!data) notFound()

  const { market, meta } = data

  // Flatten newlines from the seller's free-text description — JSON-LD
  // description fields render as a single run of text. Mirrors the same
  // transform in generateMetadata().
  const flatDescription = market.description?.replace(/\s+/g, ' ').trim()

  // Drafts are organizer-only previews (cookie-auth, RLS-gated). Skip
  // JSON-LD + the SEO cross-linking block so no structured data for
  // unpublished markets ends up in the HTML body. generateMetadata
  // already emits robots:noindex for drafts.
  if (!market.publishedAt) {
    return <>{children}</>
  }

  // Fetch nearby markets server-side for SEO cross-linking.
  // Falls back to empty array if coordinates are missing or the RPC fails.
  let nearby: FleaMarketNearByView[] = []
  if (market.latitude && market.longitude) {
    try {
      const geo = await getGeoService(source)
      const results = await geo.nearbyMarkets(
        { lat: market.latitude, lng: market.longitude },
        50,
      )
      // Exclude the current market (appears at distance ≈ 0) and cap at 6.
      nearby = results
        .filter((m) => m.slug !== slug)
        .slice(0, 6)
    } catch {
      // Non-fatal — nearby block is a nice-to-have; don't break the page.
      nearby = []
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: market.name,
    description: flatDescription,
    address: {
      '@type': 'PostalAddress',
      streetAddress: market.street,
      postalCode: market.zipCode,
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
    ...(market.openingHourRules.length > 0
      ? {
          openingHoursSpecification: market.openingHourRules
            .filter((r) => r.type !== 'biweekly')
            .map((r) => ({
              '@type': 'OpeningHoursSpecification',
              ...(r.type === 'weekly' && r.dayOfWeek !== null
                ? { dayOfWeek: SCHEMA_DAYS[r.dayOfWeek] }
                : {}),
              ...(r.type === 'date' && r.anchorDate
                ? { validFrom: r.anchorDate, validThrough: r.anchorDate }
                : {}),
              opens: r.openTime.slice(0, 5),
              closes: r.closeTime.slice(0, 5),
            })),
        }
      : {}),
    ...(meta.price_range
      ? { priceRange: `${meta.price_range.min_sek}-${meta.price_range.max_sek} SEK` }
      : {}),
    ...(meta.image_url ? { image: meta.image_url } : {}),
  }

  // Breadcrumb funnels link equity from the (large) detail-page set up into
  // the SEO hubs we actually want to rank: /loppisar → /loppisar/[city].
  // Previously this pointed at /search and /search?city= — but /search?q= is
  // noindex, so the hierarchy leaked authority into a dead end.
  const citySlug = slugifyCity(market.city)
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/loppisar' },
      { '@type': 'ListItem', position: 3, name: market.city, item: `https://fyndstigen.se/loppisar/${citySlug}` },
      { '@type': 'ListItem', position: 4, name: market.name },
    ],
  }

  // One Event per upcoming dated opening rule. Permanent markets and
  // weekly recurring hours stay on LocalBusiness/OpeningHoursSpecification
  // — Google's Event rich results expect a concrete future date.
  const todayIso = new Date().toISOString().slice(0, 10)
  const eventLds = market.openingHourRules
    .filter((r) => r.type === 'date' && r.anchorDate && r.anchorDate >= todayIso)
    .map((r) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `${market.name} — ${r.anchorDate}`,
      startDate: `${r.anchorDate}T${r.openTime.slice(0, 5)}`,
      endDate: `${r.anchorDate}T${r.closeTime.slice(0, 5)}`,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: market.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: market.street,
          postalCode: market.zipCode,
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
      ...(flatDescription ? { description: flatDescription.slice(0, 500) } : {}),
      ...(meta.image_url ? { image: meta.image_url } : {}),
      ...(meta.price_range
        ? {
            offers: {
              '@type': 'Offer',
              price: meta.price_range.min_sek,
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
      <section className="max-w-4xl mx-auto px-6 pb-4">
        <Link
          href={`/loppisar/${citySlug}`}
          className="text-rust hover:underline font-medium"
        >
          Alla loppisar i {market.city} →
        </Link>
      </section>
      {nearby.length > 0 && <NearbyMarketsSection markets={nearby} />}
    </>
  )
}

export async function LoppisPageView({ slug, source }: { slug: string; source: LoppisSource }) {

  // E2E bypass — server-side Supabase isn't available under the in-memory
  // bridge, so treat slug as id and let the client resolve via deps.
  if (process.env.NEXT_PUBLIC_E2E_FAKE === '1') {
    return (
      <>
        <TrackMarketView marketId={slug} slug={slug} />
        <MarketDetail id={slug} market={null} tables={[]} />
      </>
    )
  }

  const data = await source.resolve(slug)

  if (!data) {
    // Check slug history — the market may have been renamed. If we find a
    // match, permanentRedirect to the current slug (Next.js sends HTTP 308;
    // Google treats 308 == 301 for ranking purposes).
    const supabase = await source.client()
    const { data: hist } = await supabase
      .from('flea_market_slug_history')
      .select('flea_market_id, flea_markets!inner(slug)')
      .eq('old_slug', slug)
      .maybeSingle()
    const fm = hist?.flea_markets
    const currentSlug = (Array.isArray(fm) ? fm[0]?.slug : (fm as { slug: string } | null | undefined)?.slug) as string | undefined
    if (currentSlug) {
      permanentRedirect(`/loppis/${currentSlug}`)
    }
    notFound()
  }

  return (
    <>
      <TrackMarketView marketId={data.id} slug={slug} />
      <MarketDetail id={data.id} market={data.market} tables={data.tables} />
    </>
  )
}
