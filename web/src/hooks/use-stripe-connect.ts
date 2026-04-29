'use client'

import { useEffect, useState } from 'react'
import { endpoints } from '@/lib/edge'

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
      const data = await endpoints['stripe.connect.status'].invoke({})
      setConnected(data.connected)
      setOnboardingComplete(data.onboarding_complete)
    } catch {
      setError('Kunde inte hämta Stripe-status')
    } finally {
      setLoading(false)
    }
  }

  async function startOnboarding() {
    try {
      setError(null)
      const data = await endpoints['stripe.connect.create'].invoke({})
      window.location.href = data.url
    } catch {
      setError('Kunde inte starta Stripe-koppling')
    }
  }

  async function refreshOnboarding() {
    try {
      setError(null)
      const data = await endpoints['stripe.connect.refresh'].invoke({})
      window.location.href = data.url
    } catch {
      setError('Kunde inte generera ny Stripe-länk')
    }
  }

  return { connected, onboardingComplete, loading, error, startOnboarding, refreshOnboarding }
}
