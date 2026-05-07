'use client'

import { useEffect, useRef } from 'react'
import type { FleaMarketNearBy } from '@fyndstigen/shared'
import type { RouteBuilderStop } from '@/components/route-builder/stop-list'
import { readDraft, writeDraft, clearDraft as clearDraftFn, DRAFT_KEY } from './draft'
import type { RouteDraft } from './draft'

export type { RouteDraft }
export { DRAFT_KEY }

type PostHogLike = { capture: (event: string, props?: Record<string, unknown>) => void }

type DraftState = {
  name: string
  plannedDate: string
  useGps: boolean
  customStart: { lat: number; lng: number } | null
  stops: RouteBuilderStop[]
}

export function useDraftPersistence(
  markets: FleaMarketNearBy[] | undefined,
  state: DraftState,
  setName: (v: string) => void,
  setPlannedDate: (v: string) => void,
  setUseGps: (v: boolean) => void,
  setCustomStart: (v: { lat: number; lng: number } | null) => void,
  setStops: (v: RouteBuilderStop[]) => void,
  storage: Storage,
  posthog: PostHogLike | undefined,
  now: () => number,
) {
  const restoredRef = useRef(false)

  // One-shot restore: waits for markets to load, then applies saved draft once.
  useEffect(() => {
    if (restoredRef.current) return
    if (!markets || markets.length === 0) return

    restoredRef.current = true
    const draft = readDraft(storage, now)
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
      const ageMins = Math.round((now() - Date.parse(draft.savedAt)) / 60_000)
      posthog?.capture('route_draft_restored', {
        stop_count: resolved.length,
        age_minutes: ageMins,
      })
    }
  // setName, setPlannedDate, setUseGps, setCustomStart, setStops are all stable
  // useState setter references — omitting them from deps avoids spurious re-runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, storage, posthog, now])

  // Debounced persist: writes on any change to relevant state, skips empty stops.
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (state.stops.length === 0) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      writeDraft(storage, {
        name: state.name,
        plannedDate: state.plannedDate,
        useGps: state.useGps,
        customStart: state.customStart,
        stops: state.stops.map((s) => ({ marketId: s.market.id, index: s.index })),
        savedAt: new Date(now()).toISOString(),
      })
    }, 250)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [state.name, state.plannedDate, state.useGps, state.customStart, state.stops, storage, now])

  return {
    clearDraft: () => clearDraftFn(storage),
  }
}
