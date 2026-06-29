import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity, DISTRICT_SLUG_TO_PARENT_SLUG } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { FollowButton } from '@/components/follow-button'
import { marketUrl } from '@/lib/urls'
import { CityMarketLink } from './city-market-link'
import { TrackCityEmailClick } from './track-city-email-click'
import { formatWeeklyHoursSummary } from './format-weekly-hours'

// ISR: revalidate every hour — city listing pages are stable; kvartersloppisar
// are dated events so 1h staleness is acceptable.
export const revalidate = 3600

type Props = {
  params: Promise<{ city: string }>
}

function getServerData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  return createSupabaseServerData(supabase)
}

function isPlaceholderEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !url || url.includes('placeholder.supabase.co')
}

async function resolveCity(slug: string) {
  if (isPlaceholderEnv()) return null
  const cities = await getServerData().listCitiesWithMarkets()
  // city values are already canonical (districts folded in by the adapter).
  const match = cities.find((c) => slugifyCity(c.city) === slug)
  if (!match) return null
  return {
    canonicalName: match.city,
    cityNames: match.rawLabels, // raw labels for listMarketsInCity(.in('city', …))
    marketCount: match.marketCount,
  }
}

export async function generateStaticParams() {
  // Pre-render all city pages at build time — city list is bounded and
  // changes infrequently. ISR (revalidate = 3600) handles new cities.
  if (isPlaceholderEnv()) return []
  const cities = await getServerData().listCitiesWithMarkets()
  return cities.map((c) => ({ city: slugifyCity(c.city) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  const resolved = await resolveCity(slug)
  if (!resolved) return { title: 'Stad hittades inte' }
  // Front-load the head terms people actually search: "loppis [stad]",
  // "second hand [stad]", "loppmarknad [stad]" (all seen in GSC). The old
  // title only mentioned "loppis", so we never ranked for the second-hand
  // variants despite having the inventory.
  const title = `Loppis & second hand i ${resolved.canonicalName} — ${resolved.marketCount} ${resolved.marketCount === 1 ? 'loppis' : 'loppisar'}`
  const description = `${resolved.marketCount} ${resolved.marketCount === 1 ? 'loppis' : 'loppisar'}, second hand-butiker och loppmarknader i ${resolved.canonicalName}. Hitta öppettider, adresser och boka bord på Fyndstigen.`
  const url = `/loppisar/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'sv_SE',
      url,
      images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo-512.png'],
    },
  }
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params
  const parentSlug = DISTRICT_SLUG_TO_PARENT_SLUG[slug]
  if (parentSlug && parentSlug !== slug) {
    permanentRedirect(`/loppisar/${parentSlug}`)
  }
  const resolved = await resolveCity(slug)
  if (!resolved) notFound()

  const server = getServerData()
  const [markets, blockSalesInCity, nearbyCities] = await Promise.all([
    server.listMarketsInCity(resolved.cityNames),
    server.listBlockSalesInCity(resolved.canonicalName),
    server.nearbyCitiesWithMarkets(resolved.canonicalName),
  ])

  // Data-driven intro prose — gives each city page unique, keyword-rich body
  // text instead of a bare list (thin content ranks poorly). The permanent vs
  // temporary split is computed from the markets actually listed below, so the
  // numbers always match what the visitor sees.
  const permanentCount = markets.filter((m) => m.is_permanent).length
  const temporaryCount = markets.length - permanentCount
  const introParts: string[] = []
  if (permanentCount > 0) introParts.push(`${permanentCount} permanenta second hand-butiker`)
  if (temporaryCount > 0) introParts.push(`${temporaryCount} tillfälliga loppisar och loppmarknader`)
  const introBreakdown = introParts.join(' och ')

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/loppisar' },
      { '@type': 'ListItem', position: 3, name: resolved.canonicalName },
    ],
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: markets.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://fyndstigen.se${marketUrl(m)}`,
      name: m.name,
    })),
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <TrackCityEmailClick />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/</g, '\\u003c') }}
      />

      <nav aria-label="breadcrumb" className="text-sm text-espresso/75 mb-4">
        <Link href="/" className="hover:text-espresso">Start</Link>
        <span className="mx-2">/</span>
        <Link href="/loppisar" className="hover:text-espresso">Loppisar</Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">{resolved.canonicalName}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            Loppis &amp; second hand i {resolved.canonicalName}
          </h1>
          <p className="text-espresso/75 mt-2">
            I {resolved.canonicalName} har Fyndstigen samlat {markets.length} {markets.length === 1 ? 'loppis' : 'loppisar'}
            {introBreakdown ? ` — ${introBreakdown}` : ''}. Se öppettider, adress och boka bord direkt.
          </p>
        </div>
        <div className="shrink-0 mt-1">
          <FollowButton kind="city" target={slug} source="city_page" />
        </div>
      </div>

      {blockSalesInCity.length > 0 && (
        <section className="mt-6 mb-8">
          <h2 className="font-display text-xl font-bold">Kvartersloppisar i {resolved.canonicalName}</h2>
          <ul className="mt-2 space-y-2">
            {blockSalesInCity.map((bs) => (
              <li key={bs.id}>
                <Link href={`/kvartersloppis/${bs.slug}`} className="link">
                  {bs.name} · {bs.startDate}{bs.endDate !== bs.startDate ? `–${bs.endDate}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(() => {
        const groups = new Map<string, typeof markets>()
        for (const m of markets) {
          const arr = groups.get(m.city) ?? []
          arr.push(m)
          groups.set(m.city, arr)
        }
        const orderedLabels = Array.from(groups.keys()).sort((a, b) => {
          if (a === resolved.canonicalName) return -1
          if (b === resolved.canonicalName) return 1
          return a.localeCompare(b, 'sv')
        })
        const showHeadings = groups.size > 1
        // Precompute per-group position offsets so `position` is globally unique
        // across all district groups (analytics regression guard).
        const groupOffsets = new Map<string, number>()
        let runningOffset = 0
        for (const label of orderedLabels) {
          groupOffsets.set(label, runningOffset)
          runningOffset += groups.get(label)!.length
        }
        return orderedLabels.map((label) => (
          <section key={label} className="mt-8">
            {showHeadings && (
              <h2 className="font-display text-xl font-bold mb-3">
                {label} ({groups.get(label)!.length})
              </h2>
            )}
            <div className="space-y-4">
              {groups.get(label)!.map((m, i) => (
                <CityMarketLink
                  key={m.id}
                  href={marketUrl(m)}
                  marketId={m.id}
                  marketSlug={m.slug}
                  citySlug={slug}
                  position={groupOffsets.get(label)! + i}
                >
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-cream-warm shrink-0">
                    {m.image_url ? (
                      <Image src={m.image_url} alt={m.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FyndstigenLogo size={28} className="text-espresso/15" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <h3 className="font-display font-bold truncate min-w-0">{m.name}</h3>
                      <span className={`stamp text-xs self-start sm:self-auto shrink-0 ${m.is_permanent ? 'text-forest' : 'text-mustard'}`}>
                        {m.is_permanent ? 'Permanent' : 'Tillfällig'}
                      </span>
                    </div>
                    <p className="text-sm text-espresso/75 mt-0.5 truncate">{m.street}, {m.city}</p>
                    {m.description && (
                      <p className="text-sm text-espresso/55 mt-1 line-clamp-2">{m.description}</p>
                    )}
                    {(() => {
                      const hours = formatWeeklyHoursSummary(m.openingHourRules)
                      if (!hours) return null
                      return (
                        <p className="text-sm text-espresso/65 mt-1">
                          <span aria-hidden="true">🕐</span>
                          <span className="sr-only">Öppettider:</span>
                          {' '}{hours}
                          {m.isSystemOwned && (
                            <span className="text-espresso/40 text-xs ml-2">· auto-importerat</span>
                          )}
                        </p>
                      )
                    })()}
                  </div>
                  <span className="text-espresso/20 shrink-0">→</span>
                </CityMarketLink>
              ))}
            </div>
          </section>
        ))
      })()}

      {nearbyCities.length > 0 && (
        <section className="mt-10 pt-8 border-t border-cream-warm">
          <h2 className="font-display text-xl font-bold mb-3">
            Loppisar i närheten av {resolved.canonicalName}
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {nearbyCities.map((c) => (
              <li key={c.city}>
                <Link
                  href={`/loppisar/${slugifyCity(c.city)}`}
                  className="text-rust hover:underline"
                >
                  {c.city}
                </Link>
                <span className="text-espresso/55 ml-1">
                  ({c.marketCount}, {Math.round(c.distanceKm)} km)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 text-center">
        <p className="text-sm text-espresso/75">
          Letar du på en annan ort? <Link href="/search" className="text-rust hover:underline">Sök bland alla loppisar →</Link>
        </p>
      </div>

      <h2 className="sr-only">Om loppisar i {resolved.canonicalName}</h2>
      <p className="sr-only">
        Hitta {resolved.canonicalName} loppisar och loppmarknader. Sortera efter
        permanenta och tillfälliga loppisar, se öppettider och boka bord direkt via Fyndstigen.
      </p>
    </div>
  )
}
