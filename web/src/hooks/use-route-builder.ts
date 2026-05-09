'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { useDeps } from '@/providers/deps-provider'
import { useAuth } from '@/lib/auth/auth-context'
import { geo as defaultGeo } from '@/lib/geo'
import type { FleaMarketNearBy, GeoService, Coord, AuthUser } from '@fyndstigen/shared'
import type { RouteRepository } from '@fyndstigen/shared'
import type { Stop } from '@fyndstigen/shared'
import type { RouteBuilderStop } from '@/components/route-builder/stop-list'
import { useMarketsQuery } from './route-builder/use-markets-query'
import { useDraftPersistence } from './route-builder/use-draft-persistence'
import { useGpsReader } from './route-builder/use-gps-reader'
import { useRouteSave } from './route-builder/use-route-save'
import type { RouteSaveProgress } from './route-builder/use-route-save'

export type { RouteSaveProgress }

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

type PostHogLike = { capture: (event: string, props?: Record<string, unknown>) => void }

export type RouteBuilderDeps = {
  routes?: RouteRepository
  geo?: GeoService
  storage?: Storage
  geolocation?: Geolocation
  posthog?: PostHogLike
  router?: { push: (href: string) => void }
  user?: AuthUser | null
  now?: () => number
}

export interface RouteBuilderState {
  name: string
  setName: (v: string) => void
  plannedDate: string
  setPlannedDate: (v: string) => void
  useGps: boolean
  setUseGps: (v: boolean) => void
  customStart: Coord | null
  setCustomStart: (v: Coord | null) => void
  stops: RouteBuilderStop[]
  toggleStop: (marketId: string) => void
  reorderStops: (from: number, to: number) => void
  removeStop: (marketId: string) => void
  optimize: () => Promise<void>
  save: () => void
  saveAnon: (email: string) => void
  clearDraft: () => void
  markets: FleaMarketNearBy[] | undefined
  isOptimizing: boolean
  isSaving: boolean
  saveProgress: RouteSaveProgress | null
  gpsError: string | null
  /** GPS-resolved user position (set when useGps=true and permission granted) */
  userPos: Coord | null
}

export interface RouteBuilderOptions {
  /** Only 'new' is implemented in this PR. */
  mode?: 'new' | 'edit'
  onSaved?: (slug: string) => void
  /** Test-only override — injects fake implementations for all dependencies. */
  deps?: RouteBuilderDeps
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

function resolveDeps(
  override: RouteBuilderDeps | undefined,
  ctxDeps: ReturnType<typeof useDeps>,
  user: AuthUser | null,
  posthog: ReturnType<typeof usePostHog>,
  router: { push: (href: string) => void },
): Required<RouteBuilderDeps> {
  return {
    routes: override?.routes ?? ctxDeps.routes,
    geo: override?.geo ?? defaultGeo,
    storage: override?.storage ?? globalThis.localStorage,
    geolocation: override?.geolocation ?? globalThis.navigator?.geolocation,
    posthog: override?.posthog ?? posthog ?? undefined,
    router: override?.router ?? router,
    user: 'user' in (override ?? {}) ? (override!.user ?? null) : user,
    now: override?.now ?? Date.now,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRouteBuilder(opts?: RouteBuilderOptions): RouteBuilderState {
  if (opts?.mode === 'edit') {
    // TODO: edit mode requires routeId + initialDraft hydration (YAGNI — implement in follow-up)
    // eslint-disable-next-line no-restricted-syntax -- programming invariant: edit mode not yet implemented
    throw new Error('useRouteBuilder: edit mode is not yet implemented')
  }

  const router = useRouter()
  const { user } = useAuth()
  const posthog = usePostHog()
  const ctxDeps = useDeps()

  const deps = resolveDeps(opts?.deps, ctxDeps, user, posthog, router)

  // --- Core state ---
  const [name, setName] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [useGps, setUseGps] = useState(true)
  const [customStart, setCustomStart] = useState<Coord | null>(null)
  const [stops, setStops] = useState<RouteBuilderStop[]>([])
  const [isOptimizing, setIsOptimizing] = useState(false)

  // --- Markets ---
  const markets = useMarketsQuery(deps.geo)

  // --- GPS ---
  const { userPos, gpsError } = useGpsReader(useGps, deps.geolocation)

  // --- Draft persistence ---
  const { clearDraft } = useDraftPersistence(
    markets,
    { name, plannedDate, useGps, customStart, stops },
    setName,
    setPlannedDate,
    setUseGps,
    setCustomStart,
    setStops,
    deps.storage,
    deps.posthog,
    deps.now,
  )

  // --- Save ---
  const { isSaving, saveProgress, save: runSave } = useRouteSave({
    routes: deps.routes,
    posthog: deps.posthog,
    router: deps.router,
    user: deps.user,
    onClearDraft: clearDraft,
  })

  // --- Anon login-blocked telemetry (one-shot per session) ---
  const loginBlockedReportedRef = useRef(false)
  useEffect(() => {
    if (!deps.user && stops.length > 0 && !loginBlockedReportedRef.current) {
      deps.posthog?.capture('route_login_blocked', { stop_count: stops.length })
      loginBlockedReportedRef.current = true
    }
  }, [deps.user, stops.length, deps.posthog])

  // --- Stop mutations ---
  const toggleStop = useCallback((marketId: string) => {
    setStops((prev) => {
      const exists = prev.some((s) => s.market.id === marketId)
      if (exists) {
        return prev.filter((s) => s.market.id !== marketId)
      }
      const market = markets?.find((m) => m.id === marketId)
      if (!market) return prev
      deps.posthog?.capture('route_market_added', {
        flea_market_id: market.id,
        market_name: market.name,
        market_city: market.city,
      })
      return [...prev, { market, index: prev.length }]
    })
  }, [markets, deps.posthog])

  const reorderStops = useCallback((from: number, to: number) => {
    setStops((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const removeStop = useCallback((marketId: string) => {
    setStops((prev) => prev.filter((s) => s.market.id !== marketId))
  }, [])

  // --- Optimize ---
  const optimize = useCallback(async () => {
    if (stops.length < 2) return
    setIsOptimizing(true)
    try {
      const asStops: Stop[] = stops.map((s) => ({
        id: s.market.id,
        lat: s.market.latitude,
        lng: s.market.longitude,
      }))
      const startPoint =
        !useGps && customStart ? customStart : userPos ? userPos : undefined
      const optimized = deps.geo.optimizeStops(asStops, startPoint)
      setStops(
        optimized.map((opt, i) => ({
          market: stops.find((s) => s.market.id === opt.id)!.market,
          index: i,
        })),
      )
    } finally {
      setIsOptimizing(false)
    }
  }, [stops, useGps, customStart, userPos, deps.geo])

  // --- Save (auth) ---
  const save = useCallback(() => {
    runSave(name, plannedDate, useGps, customStart, userPos, stops)
  }, [runSave, name, plannedDate, useGps, customStart, userPos, stops])

  // --- Save (anon) — placeholder; AnonSaveForm handles its own submission ---
  const saveAnon = useCallback((_email: string) => {
    // AnonSaveForm manages its own submit flow (fetches route.create-anon endpoint).
    // This stub exists to satisfy the RouteBuilderState interface so the component
    // can optionally delegate here in a future refactor.
  }, [])

  return {
    name, setName,
    plannedDate, setPlannedDate,
    useGps, setUseGps,
    customStart, setCustomStart,
    stops, toggleStop, reorderStops, removeStop,
    optimize, save, saveAnon, clearDraft,
    markets,
    isOptimizing, isSaving, saveProgress, gpsError,
    userPos,
  }
}
