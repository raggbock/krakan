'use client'

import { api, RouteWithStops, RouteSummary } from '@/lib/api'
import { useQuery } from './use-query'

export function useRoute(id: string | undefined) {
  const { data, loading, error } = useQuery(
    () => api.routes.get(id!),
    { deps: [id], enabled: !!id, errorMessage: 'Kunde inte ladda rundan' },
  )
  return { route: data ?? null as RouteWithStops | null, loading, error }
}

export function useRoutesByUser(userId: string | undefined) {
  const { data, loading, error } = useQuery(
    () => api.routes.listByUser(userId!),
    { deps: [userId], enabled: !!userId, errorMessage: 'Kunde inte ladda rundor' },
  )
  return { routes: data ?? [] as RouteSummary[], loading, error }
}
