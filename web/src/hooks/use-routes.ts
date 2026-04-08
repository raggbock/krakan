'use client'

import { useEffect, useState } from 'react'
import { api, RouteWithStops, RouteSummary } from '@/lib/api'

export function useRoute(id: string | undefined) {
  const [route, setRoute] = useState<RouteWithStops | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.routes
      .get(id)
      .then(setRoute)
      .catch(() => setRoute(null))
      .finally(() => setLoading(false))
  }, [id])

  return { route, loading }
}

export function useRoutesByUser(userId: string | undefined) {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    api.routes
      .listByUser(userId)
      .then(setRoutes)
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false))
  }, [userId])

  return { routes, loading }
}
