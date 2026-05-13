import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity } from '@fyndstigen/shared'
import { FollowButton } from '@/components/follow-button'

// ISR: revalidate every hour — city list changes infrequently.
export const revalidate = 3600

const loppisarTitle = 'Loppisar i Sverige — bläddra alla städer'
const loppisarDescription =
  'Hitta loppisar och loppmarknader i hela Sverige. Bläddra bland alla städer där Fyndstigen har samlat loppisar, se antal loppisar per stad och hitta öppettider.'

export const metadata: Metadata = {
  title: loppisarTitle,
  description: loppisarDescription,
  alternates: { canonical: '/loppisar' },
  openGraph: {
    title: loppisarTitle,
    description: loppisarDescription,
    type: 'website',
    locale: 'sv_SE',
    url: '/loppisar',
    images: [{ url: '/logo-512.png', width: 512, height: 512, alt: 'Fyndstigen' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: loppisarTitle,
    description: loppisarDescription,
    images: ['/logo-512.png'],
  },
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

type CityEntry = {
  slug: string
  canonicalName: string
  marketCount: number
}

async function getCities(): Promise<CityEntry[]> {
  if (isPlaceholderEnv()) return []
  const raw = await getServerData().listCitiesWithMarkets()

  // Dedupe by slug (same city with different casings → collapse, sum counts)
  const map = new Map<string, CityEntry>()
  for (const c of raw) {
    const slug = slugifyCity(c.city)
    const existing = map.get(slug)
    if (existing) {
      existing.marketCount += c.marketCount
    } else {
      map.set(slug, { slug, canonicalName: c.city, marketCount: c.marketCount })
    }
  }

  // Sort by marketCount DESC so popular cities come first
  return Array.from(map.values()).sort((a, b) => b.marketCount - a.marketCount)
}

export default async function LoppisarPage() {
  const cities = await getCities()

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/loppisar' },
    ],
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Loppisar i Sverige — alla städer',
    description: 'Alla städer där Fyndstigen har samlat loppisar och loppmarknader.',
    numberOfItems: cities.length,
    itemListElement: cities.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://fyndstigen.se/loppisar/${c.slug}`,
      name: c.canonicalName,
    })),
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/</g, '\\u003c') }}
      />

      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="text-sm text-espresso/60 mb-4">
        <Link href="/" className="hover:text-espresso">Start</Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">Loppisar</span>
      </nav>

      {/* Hero */}
      <div className="animate-fade-up">
        <span className="stamp text-rust text-xs">Stadsguide</span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3">
          Loppisar i Sverige
        </h1>
        <p className="text-espresso/65 mt-3 max-w-xl leading-relaxed">
          Här hittar du alla städer där Fyndstigen samlar loppisar och loppmarknader.
          Klicka på en stad för att se alla loppisar där.
        </p>
        {cities.length > 0 && (
          <p className="text-sm text-espresso/50 mt-1">
            {cities.length} {cities.length === 1 ? 'stad' : 'städer'} &mdash;{' '}
            {cities.reduce((sum, c) => sum + c.marketCount, 0)} loppisar totalt
          </p>
        )}
      </div>

      {/* City grid */}
      {cities.length === 0 ? (
        <div className="vintage-card p-10 text-center mt-10 animate-fade-up">
          <p className="text-espresso/65">Inga städer hittades ännu.</p>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up delay-1">
          {cities.map((city) => (
            <li key={city.slug} className="vintage-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <Link
                  href={`/loppisar/${city.slug}`}
                  className="flex-1 min-w-0 group hover:text-rust transition-colors"
                >
                  <span className="font-display font-bold group-hover:text-rust transition-colors truncate block">
                    {city.canonicalName}
                  </span>
                  <span className="text-sm text-espresso/55 mt-0.5 block">
                    {city.marketCount === 1 ? '1 loppis' : `${city.marketCount} loppisar`}
                  </span>
                </Link>
                <FollowButton kind="city" target={city.slug} source="hub" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer CTA */}
      <div className="mt-12 text-center animate-fade-up delay-2">
        <p className="text-sm text-espresso/60">
          Hittar du inte din stad?{' '}
          <Link href="/search" className="text-rust hover:underline">
            Sök bland alla loppisar →
          </Link>
        </p>
      </div>
    </div>
  )
}
