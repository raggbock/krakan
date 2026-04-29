import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerData, slugifyCity } from '@fyndstigen/shared'
import MapViewClient from '@/components/map-view-client'

async function fetchCities() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
  )
  const server = createSupabaseServerData(supabase)
  return server.listCitiesWithMarkets()
}

export default async function MapPage() {
  const cities = await fetchCities()

  // Dedupe by slug, then sort by marketCount desc, then alphabetically
  const deduped = cities
    .filter(
      (c, i, arr) =>
        arr.findIndex((x) => slugifyCity(x.city) === slugifyCity(c.city)) === i,
    )
    .sort((a, b) => b.marketCount - a.marketCount || a.city.localeCompare(b.city, 'sv'))

  return (
    <div className="flex flex-col min-h-screen">
      {/* Interactive map — loaded only on the client (Leaflet requires browser APIs) */}
      <div className="flex-1">
        <MapViewClient />
      </div>

      {/* SSR-rendered fallback for crawlers and initial HTML */}
      <section className="max-w-5xl mx-auto w-full px-6 py-12">
        <div className="vintage-card p-8 animate-fade-up">
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            Loppisar i Sverige på karta
          </h1>
          <p className="text-espresso/65 max-w-2xl leading-relaxed mb-8">
            Utforska loppisar och loppmarknader i hela Sverige direkt på kartan.
            Klicka på en markör för att se öppettider, plats och mer information
            om loppisar och andrahandsmarknader nära dig.
          </p>

          {deduped.length > 0 && (
            <>
              <h2 className="font-display text-xl font-semibold mb-4 text-espresso/80">
                Städer med loppisar
              </h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {deduped.map((c) => (
                  <li key={slugifyCity(c.city)}>
                    <Link
                      href={`/loppisar/${slugifyCity(c.city)}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-parchment-light border border-cream-warm hover:bg-mustard/10 hover:border-mustard/40 transition-colors text-sm font-medium text-espresso group"
                    >
                      <span className="group-hover:text-rust transition-colors">
                        {c.city}
                      </span>
                      <span className="text-xs text-espresso/45 shrink-0">
                        {c.marketCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
