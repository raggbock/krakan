'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ConnectState = {
  connected: boolean
  onboardingComplete: boolean
  loading: boolean
  error: string | null
  startOnboarding: () => Promise<void>
  refreshOnboarding: () => Promise<void>
}

export function useStripeConnect(
  userId: string | undefined,
  enabled: boolean = true,
): ConnectState {
  const [connected, setConnected] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false)
      return
    }
    checkStatus()
  }, [userId, enabled])

  async function checkStatus() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await supabase.functions.invoke('stripe-connect-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.error) throw res.error
      setConnected(res.data.connected)
      setOnboardingComplete(res.data.onboarding_complete)
    } catch {
      setError('Kunde inte hämta Stripe-status')
    } finally {
      setLoading(false)
    }
  }

  async function startOnboarding() {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await supabase.functions.invoke('stripe-connect-create', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.error) throw res.error
      window.location.href = res.data.url
    } catch {
      setError('Kunde inte starta Stripe-koppling')
    }
  }

  async function refreshOnboarding() {
    try {
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await supabase.functions.invoke('stripe-connect-refresh', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.error) throw res.error
      window.location.href = res.data.url
    } catch {
      setError('Kunde inte generera ny Stripe-länk')
    }
  }

  return { connected, onboardingComplete, loading, error, startOnboarding, refreshOnboarding }
}
