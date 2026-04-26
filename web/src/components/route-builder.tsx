'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, geo } from '@/lib/api'
import type { FleaMarketNearBy } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { usePostHog } from 'posthog-js/react'
import type { OpeningHourRule, OpeningHourException, Stop } from '@fyndstigen/shared'
import { runRouteMutation } from '@fyndstigen/shared'
import { FyndstigenLogo } from './fyndstigen-logo'
import { RouteFormFields } from './route-builder/route-form-fields'
import { StopList, type RouteBuilderStop } from './route-builder/stop-list'
import { RouteMap } from './route-builder/route-map'
import { SaveRouteButton } from './route-builder/save-route-button'

type MarketWithHours = FleaMarketNearBy & {
  opening_hour_rules?: OpeningHourRule[]
  opening_hour_exceptions?: OpeningHourException[]
}

export default function RouteBuilder() {
  const router = useRouter()
  const { user } = useAuth()
  const posthog = usePostHog()

  const [markets, setMarkets] = useState<MarketWithHours[]>([])
  const [stops, setStops] = useState<RouteBuilderStop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [name, setName] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [useGps, setUseGps] = useState(true)
  const [customStart, setCustomStart] = useState<{ lat: number; lng: number } | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  // Load markets
  useEffect(() => {
    // National radius — see map-view.tsx for the rationale. The route
    // builder filters by user-selected area client-side anyway.
    geo.nearbyMarkets({ lat: 59.27, lng: 15.21 }, 2000)
      .then((data) => setMarkets(data ?? []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [])

  // Get user GPS
  useEffect(() => {
    if (useGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
      )
    }
  }, [useGps])

  const isInRoute = useCallback(
    (marketId: string) => stops.some((s) => s.market.id === marketId),
    [stops],
  )

  function toggleMarket(market: MarketWithHours) {
    if (isInRoute(market.id)) {
      setStops((prev) => prev.filter((s) => s.market.id !== market.id))
    } else {
      setStops((prev) => [...prev, { market, index: prev.length }])
      posthog?.capture('route_market_added', {
        flea_market_id: market.id,
        market_name: market.name,
        market_city: market.city,
      })
    }
  }

  function handleOptimize() {
    if (stops.length < 2) return
    const asStops: Stop[] = stops.map((s) => ({
      id: s.market.id,
      lat: s.market.latitude,
      lng: s.market.longitude,
    }))
    const startPoint =
      !useGps && customStart ? customStart : userPos ? userPos : undefined
    const optimized = geo.optimizeStops(asStops, startPoint)
    setStops(
      optimized.map((opt, i) => ({
        market: stops.find((s) => s.market.id === opt.id)!.market,
        index: i,
      })),
    )
  }

  async function handleSave() {
    if (!user || !name.trim() || stops.length === 0) return
    setSaving(true)
    setSaveError('')

    const startLat = !useGps && customStart ? customStart.lat : userPos?.lat
    const startLng = !useGps && customStart ? customStart.lng : userPos?.lng

    const plan = {
      route: {
        create: {
          name: name.trim(),
          createdBy: user.id,
          startLatitude: startLat,
          startLongitude: startLng,
          plannedDate: plannedDate || undefined,
        },
      },
      stops: {
        add: stops.map((s) => ({ fleaMarketId: s.market.id })),
        remove: [] as string[],
      },
    }

    for await (const ev of runRouteMutation(plan, { api })) {
      if ('type' in ev) {
        if (ev.type === 'complete') {
          posthog?.capture('route_saved', {
            route_id: ev.routeId,
            stop_count: stops.length,
            market_ids: stops.map((s) => s.market.id),
          })
          router.push(`/rundor/${ev.routeId}`)
        } else {
          // ev.type === 'failed'
          setSaveError('Kunde inte spara rundan. Försök igen.')
          setSaving(false)
        }
        return
      }
    }
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Sidebar */}
      <div className="w-full lg:w-[400px] bg-card border-r border-cream-warm overflow-y-auto shrink-0 order-2 lg:order-1">
        <div className="p-6">
          {/* Header */}
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Tillbaka
          </Link>

          <h1 className="font-display text-2xl font-bold">Skapa loppisrunda</h1>
          <p className="text-sm text-espresso/65 mt-1">
            Klicka på loppisar i kartan eller sök nedan.
          </p>

          <RouteFormFields
            name={name}
            onNameChange={setName}
            plannedDate={plannedDate}
            onPlannedDateChange={setPlannedDate}
            useGps={useGps}
            onUseGpsChange={setUseGps}
          />

          <StopList
            stops={stops}
            plannedDate={plannedDate}
            onReorder={setStops}
            onRemove={(marketId) =>
              setStops((prev) => prev.filter((s) => s.market.id !== marketId))
            }
            onOptimize={handleOptimize}
            canOptimize={stops.length >= 2}
          />

          {user ? (
            <SaveRouteButton
              disabled={!name.trim() || stops.length === 0}
              saving={saving}
              error={saveError}
              onSave={handleSave}
            />
          ) : (
            <div className="mt-6 vintage-card p-4 text-center">
              <p className="text-sm text-espresso/65">
                <Link href="/auth" className="text-rust font-semibold">
                  Logga in
                </Link>{' '}
                för att spara din runda.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative order-1 lg:order-2 min-h-[300px] lg:min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-parchment/50">
            <FyndstigenLogo size={40} className="text-rust animate-bob" />
          </div>
        )}
        <RouteMap
          markets={markets}
          stops={stops}
          onToggleMarket={toggleMarket}
          useGps={useGps}
          customStart={customStart}
          onCustomStartChange={setCustomStart}
        />
      </div>
    </div>
  )
}
