'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { geo } from '@/lib/geo'
import { useDeps } from '@/providers/deps-provider'
import type { FleaMarketNearBy } from '@fyndstigen/shared'
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

// ---------------------------------------------------------------------------
// localStorage draft
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'fyndstigen.route-draft.v1'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type RouteDraft = {
  name: string
  plannedDate: string
  useGps: boolean
  customStart: { lat: number; lng: number } | null
  stops: Array<{ marketId: string; index: number }>
  savedAt: string // ISO
}

function readDraft(): RouteDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RouteDraft
    if (!parsed.savedAt) return null
    const age = Date.now() - Date.parse(parsed.savedAt)
    if (age > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeDraft(draft: RouteDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // localStorage unavailable (private browsing / quota exceeded) — no-op
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RouteBuilder() {
  const router = useRouter()
  const { user } = useAuth()
  const posthog = usePostHog()
  const { routes } = useDeps()

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

  // Whether we've already attempted to restore from localStorage
  const draftRestoredRef = useRef(false)

  // Load markets
  useEffect(() => {
    // National radius — see map-view.tsx for the rationale. The route
    // builder filters by user-selected area client-side anyway.
    geo.nearbyMarkets({ lat: 59.27, lng: 15.21 }, 2000)
      .then((data) => setMarkets(data ?? []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [])

  // Restore draft from localStorage once markets have loaded
  useEffect(() => {
    if (draftRestoredRef.current) return
    if (markets.length === 0) return // wait until markets are available

    draftRestoredRef.current = true
    const draft = readDraft()
    if (!draft) return

    setName(draft.name)
    setPlannedDate(draft.plannedDate)
    setUseGps(draft.useGps)
    setCustomStart(draft.customStart)

    const resolved: RouteBuilderStop[] = []
    for (const s of draft.stops) {
      const market = markets.find((m) => m.id === s.marketId)
      if (market) resolved.push({ market, index: s.index })
    }
    if (resolved.length > 0) {
      setStops(resolved)
      const ageMins = Math.round((Date.now() - Date.parse(draft.savedAt)) / 60_000)
      posthog?.capture('route_draft_restored', {
        stop_count: resolved.length,
        age_minutes: ageMins,
      })
    }
  }, [markets, posthog])

  // Persist draft to localStorage whenever relevant state changes (debounced)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (stops.length === 0) return // nothing worth persisting

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      writeDraft({
        name,
        plannedDate,
        useGps,
        customStart,
        stops: stops.map((s) => ({ marketId: s.market.id, index: s.index })),
        savedAt: new Date().toISOString(),
      })
    }, 250)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [name, plannedDate, useGps, customStart, stops])

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

  // Track when an anon user has built a real route but is blocked by the
  // login wall — this is the suspected dropoff point (see commit history).
  // Fires once per build session, not per re-render.
  const [loginBlockedReported, setLoginBlockedReported] = useState(false)
  useEffect(() => {
    if (!user && stops.length > 0 && !loginBlockedReported) {
      posthog?.capture('route_login_blocked', { stop_count: stops.length })
      setLoginBlockedReported(true)
    }
  }, [user, stops.length, posthog, loginBlockedReported])

  async function handleSave() {
    if (!user || !name.trim() || stops.length === 0) return
    posthog?.capture('route_save_attempted', { stop_count: stops.length })
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

    for await (const ev of runRouteMutation(plan, { api: { routes } })) {
      if ('type' in ev) {
        if (ev.type === 'complete') {
          posthog?.capture('route_saved', {
            route_id: ev.routeId,
            stop_count: stops.length,
            market_ids: stops.map((s) => s.market.id),
          })
          clearDraft()
          router.push(`/rundor/${ev.routeId}`)
        } else {
          // ev.type === 'failed'
          posthog?.capture('route_save_failed', { stop_count: stops.length, reason: (ev as { reason?: string }).reason ?? 'unknown' })
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
