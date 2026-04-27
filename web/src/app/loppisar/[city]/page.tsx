import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity, getInitials } from '@fyndstigen/shared'
import { FyndstigenLogo } from '@/components/fyndstigen-logo'
import { marketUrl } from '@/lib/urls'

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

async function resolveCity(slug: string) {
  const cities = await getServerData().listCitiesWithMarkets()
  const matches = cities.filter((c) => slugifyCity(c.city) === slug)
  if (matches.length === 0) return null
  return {
    canonicalName: matches[0].city,
    cityNames: matches.map((c) => c.city),
    marketCount: matches.reduce((sum, c) => sum + c.marketCount, 0),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params
  const resolved = await resolveCity(slug)
  if (!resolved) return { title: 'Stad hittades inte' }
  const title = `Hitta loppis i ${resolved.canonicalName} — ${resolved.marketCount} ${resolved.marketCount === 1 ? 'loppis' : 'loppisar'}`
  const description = `${resolved.marketCount} ${resolved.marketCount === 1 ? 'loppis' : 'loppisar'} och loppmarknader i ${resolved.canonicalName}. Hitta öppettider, adresser och boka bord på Fyndstigen.`
  return {
    title,
    description,
    alternates: { canonical: `/loppisar/${slug}` },
    openGraph: { title, description, type: 'website', locale: 'sv_SE' },
  }
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params
  const resolved = await resolveCity(slug)
  if (!resolved) notFound()

  const markets = await getServerData().listMarketsInCity(resolved.cityNames)

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Fyndstigen', item: 'https://fyndstigen.se' },
      { '@type': 'ListItem', position: 2, name: 'Loppisar', item: 'https://fyndstigen.se/search' },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/</g, '\\u003c') }}
      />

      <nav className="text-sm text-espresso/60 mb-4">
        <Link href="/" className="hover:text-espresso">Start</Link>
        <span className="mx-2">/</span>
        <Link href="/search" className="hover:text-espresso">Loppisar</Link>
        <span className="mx-2">/</span>
        <span className="text-espresso">{resolved.canonicalName}</span>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl font-bold">
        Hitta loppis i {resolved.canonicalName}
      </h1>
      <p className="text-espresso/65 mt-2">
        {resolved.marketCount} {resolved.marketCount === 1 ? 'loppis' : 'loppisar och loppmarknader'} i {resolved.canonicalName} — se öppettider, adress och boka bord direkt.
      </p>

      <div className="mt-8 space-y-4">
        {markets.map((m) => (
          <Link
            key={m.id}
            href={marketUrl(m)}
            className="vintage-card flex items-center gap-4 p-4 hover:bg-cream-warm/30 transition-colors"
          >
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-cream-warm shrink-0">
              {m.image_url ? (
                <Image
                  src={m.image_url}
                  alt={m.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FyndstigenLogo size={28} className="text-espresso/15" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold truncate">{m.name}</h2>
                <span className={`stamp text-xs ${m.is_permanent ? 'text-forest' : 'text-mustard'}`}>
                  {m.is_permanent ? 'Permanent' : 'Tillfällig'}
                </span>
              </div>
              <p className="text-sm text-espresso/65 mt-0.5 truncate">
                {m.street}, {m.city}
              </p>
              {m.description && (
                <p className="text-sm text-espresso/55 mt-1 line-clamp-2">{m.description}</p>
              )}
            </div>
            <span className="text-espresso/20 shrink-0">→</span>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm text-espresso/60">
          Letar du på en annan ort? <Link href="/search" className="text-rust hover:underline">Sök bland alla loppisar →</Link>
        </p>
      </div>

      <h2 className="sr-only">Om loppisar i {resolved.canonicalName}</h2>
      <p className="sr-only">
        Hitta {getInitials(resolved.canonicalName)} loppisar och loppmarknader. Sortera efter
        permanenta och tillfälliga loppisar, se öppettider och boka bord direkt via Fyndstigen.
      </p>
    </div>
  )
}
