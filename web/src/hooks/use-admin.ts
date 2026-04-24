'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeps } from '@/providers/deps-provider'
import { useAuth } from '@/lib/auth-context'

export const adminKeys = {
  all: ['admin'] as const,
  list: () => [...adminKeys.all, 'list'] as const,
  invites: () => [...adminKeys.all, 'invites'] as const,
  actions: () => [...adminKeys.all, 'actions'] as const,
  me: () => [...adminKeys.all, 'me'] as const,
}

export function useIsAdmin() {
  const { admin } = useDeps()
  const { user } = useAuth()
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: () => (user ? admin.isAdmin(user.id) : Promise.resolve(false)),
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useAdmins() {
  const { admin } = useDeps()
  return useQuery({ queryKey: adminKeys.list(), queryFn: () => admin.listAdmins() })
}

export function usePendingInvites() {
  const { admin } = useDeps()
  return useQuery({ queryKey: adminKeys.invites(), queryFn: () => admin.listPendingInvites() })
}

export function useAdminActions(limit = 20) {
  const { admin } = useDeps()
  return useQuery({
    queryKey: [...adminKeys.actions(), limit],
    queryFn: () => admin.listActions({ limit }),
  })
}

export function useInviteAdmin() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => admin.inviteAdmin(email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.invites() })
      qc.invalidateQueries({ queryKey: adminKeys.actions() })
    },
  })
}

export function useAcceptInvite() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => admin.acceptInvite(token),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function useRevokeInvite() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (inviteId: string) => admin.revokeInvite(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.invites() }),
  })
}

export function useRevokeAdmin() {
  const { admin } = useDeps()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => admin.revokeAdmin(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.list() }),
  })
}
