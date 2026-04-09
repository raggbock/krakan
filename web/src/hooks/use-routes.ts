'use client'

import { useEffect, useState } from 'react'
import { api, RouteWithStops, RouteSummary } from '@/lib/api'

export function useRoute(id: string | undefined) {
  const [route, setRoute] = useState<RouteWithStops | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setError(null)
    api.routes
      .get(id)
      .then(setRoute)
      .catch(() => {
        setRoute(null)
        setError('Kunde inte ladda rundan')
      })
      .finally(() => setLoading(false))
  }, [id])

  return { route, loading, error }
}

export function useRoutesByUser(userId: string | undefined) {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setError(null)
    api.routes
      .listByUser(userId)
      .then(setRoutes)
      .catch(() => setError('Kunde inte ladda rundor'))
      .finally(() => setLoading(false))
  }, [userId])

  return { routes, loading, error }
}
