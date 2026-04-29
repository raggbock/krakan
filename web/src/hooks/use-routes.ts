'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { RouteWithStops, RouteSummary, CreateRoutePayload, UpdateRoutePayload } from '@fyndstigen/shared'
import { queryKeys } from '@/lib/query-keys'
import { useDeps } from '@/providers/deps-provider'

export function useRoute(id: string | undefined) {
  const { routes } = useDeps()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.routes.details(id!),
    queryFn: () => routes.get(id!),
    enabled: !!id,
  })
  return {
    route: data ?? (null as RouteWithStops | null),
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useRoutesByUser(userId: string | undefined) {
  const { routes } = useDeps()
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.routes.byUser(userId!),
    queryFn: () => routes.listByUser(userId!),
    enabled: !!userId,
  })
  return {
    routes: data ?? ([] as RouteSummary[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}

export function useCreateRoute() {
  const { routes } = useDeps()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateRoutePayload) => routes.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.all })
    },
  })
}

export function useUpdateRoute() {
  const { routes } = useDeps()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRoutePayload }) =>
      routes.update(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.details(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.all })
    },
  })
}
