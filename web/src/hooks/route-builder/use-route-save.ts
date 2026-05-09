'use client'

import { useState } from 'react'
import { runRouteMutation } from '@fyndstigen/shared'
import type { RouteEvent } from '@fyndstigen/shared'
import type { Coord, AuthUser } from '@fyndstigen/shared'
import type { RouteRepository } from '@fyndstigen/shared'
import type { RouteBuilderStop } from '@/components/route-builder/stop-list'

export type RouteSaveProgress = RouteEvent

type PostHogLike = { capture: (event: string, props?: Record<string, unknown>) => void }

type SaveDeps = {
  routes: RouteRepository
  posthog: PostHogLike | undefined
  router: { push: (href: string) => void }
  user: AuthUser | null | undefined
  onClearDraft: () => void
}

export function useRouteSave(deps: SaveDeps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<RouteSaveProgress | null>(null)

  function save(
    name: string,
    plannedDate: string,
    useGps: boolean,
    customStart: Coord | null,
    userPos: Coord | null,
    stops: RouteBuilderStop[],
  ) {
    const { routes, posthog, router, user, onClearDraft } = deps
    if (!user || !name.trim() || stops.length === 0) return

    posthog?.capture('route_save_attempted', { stop_count: stops.length })
    setIsSaving(true)
    setSaveProgress(null)

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

    async function run() {
      for await (const ev of runRouteMutation(plan, { api: { routes } })) {
        setSaveProgress(ev)
        if ('type' in ev) {
          if (ev.type === 'complete') {
            posthog?.capture('route_saved', {
              route_id: ev.routeId,
              stop_count: stops.length,
              market_ids: stops.map((s) => s.market.id),
            })
            onClearDraft()
            setIsSaving(false)
            router.push(`/rundor/${ev.routeId}`)
          } else {
            posthog?.capture('route_save_failed', {
              stop_count: stops.length,
              reason: (ev as { error?: { message?: string } }).error?.message ?? 'unknown',
            })
            setIsSaving(false)
          }
          return
        }
      }
    }

    run().catch(() => {
      posthog?.capture('route_save_failed', { stop_count: stops.length, reason: 'unknown' })
      setIsSaving(false)
    })
  }

  return { isSaving, saveProgress, save }
}
