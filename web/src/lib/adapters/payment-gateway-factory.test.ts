import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolvePaymentGateway } from './payment-gateway-factory'
import type { Stripe, StripeElements, StripeCardElement } from '@stripe/stripe-js'

// Minimal stubs for Stripe types
function makeStripe(confirmCardPaymentImpl: (secret: string) => Promise<{ error?: { message: string } }>): Stripe {
  return {
    confirmCardPayment: vi.fn().mockImplementation(confirmCardPaymentImpl),
  } as unknown as Stripe
}

function makeElements(cardElement: StripeCardElement | null): StripeElements {
  return {
    getElement: vi.fn().mockReturnValue(cardElement),
  } as unknown as StripeElements
}

function makeCardElement(): StripeCardElement {
  return {} as StripeCardElement
}

describe('resolvePaymentGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('real Stripe gateway branch', () => {
    it('uses real stripe gateway when stripe + card element are available', async () => {
      const confirmImpl = vi.fn().mockResolvedValue({ error: undefined })
      const stripe = makeStripe(confirmImpl)
      const cardElement = makeCardElement()
      const elements = makeElements(cardElement)
      const onPaymentCompleted = vi.fn()

      const gateway = resolvePaymentGateway({ stripe, elements, onPaymentCompleted })
      const result = await gateway.confirmCardPayment('pi_secret_123')

      expect(result.status).toBe('succeeded')
      expect(confirmImpl).toHaveBeenCalledWith('pi_secret_123', {
        payment_method: { card: cardElement },
      })
    })

    it('calls onPaymentCompleted when card payment succeeds', async () => {
      const stripe = makeStripe(async () => ({ error: undefined }))
      const elements = makeElements(makeCardElement())
      const onPaymentCompleted = vi.fn()

      const gateway = resolvePaymentGateway({ stripe, elements, onPaymentCompleted })
      await gateway.confirmCardPayment('pi_secret_456')

      expect(onPaymentCompleted).toHaveBeenCalledOnce()
    })

    it('does NOT call onPaymentCompleted when card payment fails', async () => {
      const stripe = makeStripe(async () => ({ error: { message: 'Card declined' } }))
      const elements = makeElements(makeCardElement())
      const onPaymentCompleted = vi.fn()

      const gateway = resolvePaymentGateway({ stripe, elements, onPaymentCompleted })
      const result = await gateway.confirmCardPayment('pi_secret_789')

      expect(result.status).toBe('failed')
      expect(onPaymentCompleted).not.toHaveBeenCalled()
    })
  })

  describe('no-op gateway branch', () => {
    it('uses no-op when stripe is null', async () => {
      const onPaymentCompleted = vi.fn()
      const gateway = resolvePaymentGateway({ stripe: null, elements: null, onPaymentCompleted })

      // No-op succeeds silently when no clientSecret is passed (free booking path)
      const result = await gateway.confirmCardPayment('')
      expect(result.status).toBe('succeeded')
      expect(onPaymentCompleted).toHaveBeenCalledOnce()
    })

    it('uses no-op when card element is not mounted', async () => {
      const stripe = makeStripe(async () => ({ error: undefined }))
      const elements = makeElements(null) // no card element mounted
      const onPaymentCompleted = vi.fn()

      const gateway = resolvePaymentGateway({ stripe, elements, onPaymentCompleted })

      // No-op succeeds on empty secret; throws on a real secret (regression guard)
      await expect(gateway.confirmCardPayment('pi_real_secret')).rejects.toThrow('Card element not found')
    })

    it('uses no-op when elements is null', async () => {
      const stripe = makeStripe(async () => ({ error: undefined }))
      const onPaymentCompleted = vi.fn()

      const gateway = resolvePaymentGateway({ stripe, elements: null, onPaymentCompleted })

      await expect(gateway.confirmCardPayment('pi_real_secret')).rejects.toThrow('Stripe not loaded')
    })
  })
})
