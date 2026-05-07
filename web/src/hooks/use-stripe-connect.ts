'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { endpoints } from '@/lib/edge'
import { queryKeys } from '@/lib/query-keys'

const ERR_STATUS = 'Kunde inte hämta Stripe-status'
const ERR_START = 'Kunde inte starta Stripe-koppling'
const ERR_REFRESH = 'Kunde inte generera ny Stripe-länk'

function redirect(url: string): void {
  window.location.href = url
}

type ConnectState = {
  connected: boolean
  onboardingComplete: boolean
  loading: boolean
  error: string | null
  startOnboarding: () => Promise<void>
  refreshOnboarding: () => Promise<void>
}

/**
 * Stripe Connect onboarding state for the current user.
 *
 * Mirrors the use-takeover.ts pattern: useQuery for the on-mount status
 * fetch, useMutation for the two redirect actions. The bundled return
 * shape is preserved so callers (stripe-connect-button, create-market
 * page) need no changes.
 */
export function useStripeConnect(
  userId: string | undefined,
  enabled: boolean = true,
): ConnectState {
  const [actionError, setActionError] = useState<string | null>(null)

  const status = useQuery({
    queryKey: queryKeys.stripeConnect.status(userId),
    queryFn: () => endpoints['stripe.connect.status'].invoke({}),
    enabled: enabled && !!userId,
    retry: false,
  })

  const start = useMutation({
    mutationFn: () => endpoints['stripe.connect.create'].invoke({}),
    onSuccess: ({ url }) => redirect(url),
    onError: () => setActionError(ERR_START),
  })

  const refresh = useMutation({
    mutationFn: () => endpoints['stripe.connect.refresh'].invoke({}),
    onSuccess: ({ url }) => redirect(url),
    onError: () => setActionError(ERR_REFRESH),
  })

  const error = actionError ?? (status.isError ? ERR_STATUS : null)

  return {
    connected: status.data?.connected ?? false,
    onboardingComplete: status.data?.onboarding_complete ?? false,
    loading: !!userId && enabled && status.isPending,
    error,
    startOnboarding: async () => {
      setActionError(null)
      try {
        await start.mutateAsync()
      } catch {
        // onError already set the error
      }
    },
    refreshOnboarding: async () => {
      setActionError(null)
      try {
        await refresh.mutateAsync()
      } catch {
        // onError already set the error
      }
    },
  }
}
