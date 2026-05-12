'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useDeps } from '@/providers/deps-provider'

/**
 * Returns whether the given user is following the given market.
 * Returns `undefined` while loading.
 */
export function useIsFollowingMarket(
  userId: string | undefined,
  marketId: string,
): { isFollowing: boolean | undefined; isLoading: boolean } {
  const { follows } = useDeps()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.follows.isFollowingMarket(userId!, marketId),
    queryFn: () => follows.isFollowingMarket(userId!, marketId),
    enabled: !!userId,
  })
  return {
    isFollowing: userId ? data : undefined,
    isLoading,
  }
}

/**
 * Returns follow/unfollow mutators for a market.
 * Uses optimistic updates: the cache is flipped immediately on click and
 * rolled back if the server call fails.
 */
export function useFollowMarket(userId: string | undefined, marketId: string) {
  const { follows } = useDeps()
  const queryClient = useQueryClient()

  const cacheKey = queryKeys.follows.isFollowingMarket(userId ?? '', marketId)

  function toggleOptimistic(next: boolean) {
    queryClient.cancelQueries({ queryKey: cacheKey })
    const prev = queryClient.getQueryData<boolean>(cacheKey)
    queryClient.setQueryData(cacheKey, next)
    return prev
  }

  const follow = useMutation({
    mutationFn: () => follows.followMarket(userId!, marketId),
    onMutate: () => toggleOptimistic(true),
    onError: (_err, _vars, prev) => {
      queryClient.setQueryData(cacheKey, prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  const unfollow = useMutation({
    mutationFn: () => follows.unfollowMarket(userId!, marketId),
    onMutate: () => toggleOptimistic(false),
    onError: (_err, _vars, prev) => {
      queryClient.setQueryData(cacheKey, prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  return { follow, unfollow }
}

/**
 * Returns whether the given user is following the given city.
 * Returns `undefined` while loading.
 */
export function useIsFollowingCity(
  userId: string | undefined,
  citySlug: string,
): { isFollowing: boolean | undefined; isLoading: boolean } {
  const { follows } = useDeps()
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.follows.isFollowingCity(userId!, citySlug),
    queryFn: () => follows.isFollowingCity(userId!, citySlug),
    enabled: !!userId,
  })
  return {
    isFollowing: userId ? data : undefined,
    isLoading,
  }
}

/**
 * Returns follow/unfollow mutators for a city.
 * Uses optimistic updates: the cache is flipped immediately on click and
 * rolled back if the server call fails.
 */
export function useFollowCity(userId: string | undefined, citySlug: string) {
  const { follows } = useDeps()
  const queryClient = useQueryClient()

  const cacheKey = queryKeys.follows.isFollowingCity(userId ?? '', citySlug)

  function toggleOptimistic(next: boolean) {
    queryClient.cancelQueries({ queryKey: cacheKey })
    const prev = queryClient.getQueryData<boolean>(cacheKey)
    queryClient.setQueryData(cacheKey, next)
    return prev
  }

  const follow = useMutation({
    mutationFn: () => follows.followCity(userId!, citySlug),
    onMutate: () => toggleOptimistic(true),
    onError: (_err, _vars, prev) => {
      queryClient.setQueryData(cacheKey, prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  const unfollow = useMutation({
    mutationFn: () => follows.unfollowCity(userId!, citySlug),
    onMutate: () => toggleOptimistic(false),
    onError: (_err, _vars, prev) => {
      queryClient.setQueryData(cacheKey, prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: cacheKey })
    },
  })

  return { follow, unfollow }
}
