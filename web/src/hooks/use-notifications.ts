'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useDeps } from '@/providers/deps-provider'

/**
 * Returns the user's inbox notifications, paginated.
 *
 * staleTime is kept low (30s) so the bell badge and dropdown stay
 * reasonably fresh. We use polling rather than Supabase realtime to
 * avoid opening an extra WebSocket channel just for the badge count.
 */
export function useInbox(
  userId: string | undefined,
  opts: { limit?: number } = {},
) {
  const { notifications } = useDeps()
  const { limit = 10 } = opts

  return useQuery({
    queryKey: queryKeys.notifications.inbox(userId ?? '', { limit }),
    queryFn: () => notifications.listInbox(userId!, { limit }),
    enabled: !!userId,
    staleTime: 30_000,
  })
}

/**
 * Returns the unread notification count for the badge.
 * Polls every 60 seconds so the badge stays current without a WebSocket.
 */
export function useUnreadCount(userId: string | undefined) {
  const { notifications } = useDeps()

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(userId ?? ''),
    queryFn: () => notifications.unreadCount(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Mutation to mark a single notification as read.
 * Optimistically decrements the unread count and invalidates both
 * the inbox and unread count queries on settle.
 */
export function useMarkRead(userId: string | undefined) {
  const { notifications } = useDeps()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) => notifications.markRead(userId!, eventId),
    onSuccess: () => {
      if (!userId) return
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(userId),
      })
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'inbox', userId],
      })
    },
  })
}

/**
 * Mutation to mark all notifications as read.
 */
export function useMarkAllRead(userId: string | undefined) {
  const { notifications } = useDeps()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notifications.markAllRead(userId!),
    onSuccess: () => {
      if (!userId) return
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(userId),
      })
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'inbox', userId],
      })
    },
  })
}
