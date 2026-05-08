import type { loadStripe as LoadStripe } from '@stripe/stripe-js'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

// Lazily import and initialise Stripe so that @stripe/stripe-js (~286 KB) is
// NOT included in the shared Next.js bundle.  The SDK is only fetched the first
// time getStripe() is awaited — i.e. when the booking form renders.
let stripePromise: ReturnType<typeof LoadStripe> | null = null

export function getStripe(): ReturnType<typeof LoadStripe> {
  if (!publishableKey) return Promise.resolve(null)
  if (!stripePromise) {
    stripePromise = import('@stripe/stripe-js').then(({ loadStripe }) =>
      loadStripe(publishableKey),
    )
  }
  return stripePromise
}
