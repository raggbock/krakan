import Stripe from 'https://esm.sh/stripe@17?target=deno'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-03-31.basil',
      httpClient: Stripe.createFetchHttpClient(),
    })
  }
  return _stripe
}

// Backwards-compatible named export — lazy, so free-booking paths don't crash
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as Record<string | symbol, unknown>)[prop]
  },
})
