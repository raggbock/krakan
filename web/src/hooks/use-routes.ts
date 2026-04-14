'use client'

import { useQuery } from '@tanstack/react-query'
import { api, RouteWithStops, RouteSummary } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

export function useRoute(id: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.routes.details(id!),
    queryFn: () => api.routes.get(id!),
    enabled: !!id,
  })
  return {
    route: data ?? (null as RouteWithStops | null),
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useRoutesByUser(userId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.routes.byUser(userId!),
    queryFn: () => api.routes.listByUser(userId!),
    enabled: !!userId,
  })
  return {
    routes: data ?? ([] as RouteSummary[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}
