'use client'

import { useStripeConnect } from '@/hooks/use-stripe-connect'

export function StripeConnectButton({ userId }: { userId: string | undefined }) {
  const connect = useStripeConnect(userId)

  if (connect.loading) {
    return (
      <div className="bg-parchment rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-cream-warm rounded w-1/3" />
      </div>
    )
  }

  if (connect.onboardingComplete) {
    return (
      <div className="flex items-center gap-2 bg-forest/10 text-forest rounded-xl px-4 py-3 text-sm font-medium">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7L6 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Betalning kopplad
      </div>
    )
  }

  if (connect.connected) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-mustard/10 text-mustard rounded-xl px-4 py-3 text-sm font-medium">
          Stripe-koppling påbörjad men ej slutförd
        </div>
        <button
          onClick={connect.refreshOnboarding}
          className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors"
        >
          Slutför koppling
        </button>
        {connect.error && <p className="text-xs text-error">{connect.error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-espresso/65">
        Koppla betalning för att kunna ta emot bokningar.
      </p>
      <button
        onClick={connect.startOnboarding}
        className="bg-rust text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-rust-light transition-colors"
      >
        Koppla betalning
      </button>
      {connect.error && <p className="text-xs text-error">{connect.error}</p>}
    </div>
  )
}
