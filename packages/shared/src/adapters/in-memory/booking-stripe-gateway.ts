/**
 * Fake (in-memory) adapter for BookingStripeGateway — for use in tests.
 *
 * Records calls so tests can assert on idempotency-key shape,
 * application-fee math, and capture_method.
 */

import { calculateStripeAmounts } from '../../booking'
import type { BookingStripeGateway, CreatePaymentIntentArgs } from '../../ports/booking-stripe-gateway'

let _piId = 1

export type FakePaymentIntentRecord = {
  id: string
  clientSecret: string
  args: CreatePaymentIntentArgs
  totalOre: number
  applicationFeeOre: number
}

export type FakeCaptureRecord = { paymentIntentId: string }
export type FakeCancelRecord = { paymentIntentId: string; reason?: string }

export function createFakeBookingStripeGateway(opts?: {
  /** Throw this error from createPaymentIntentWithFees. Simulates Stripe failure. */
  failCreate?: Error
  /** Throw this error from capture. */
  failCapture?: Error
  /** Throw this error from cancel. */
  failCancel?: Error
}): BookingStripeGateway & {
  created: FakePaymentIntentRecord[]
  captured: FakeCaptureRecord[]
  canceled: FakeCancelRecord[]
} {
  const created: FakePaymentIntentRecord[] = []
  const captured: FakeCaptureRecord[] = []
  const canceled: FakeCancelRecord[] = []

  return {
    created,
    captured,
    canceled,

    async createPaymentIntentWithFees(args) {
      if (opts?.failCreate) throw opts.failCreate
      const { totalOre, applicationFeeOre } = calculateStripeAmounts(args.priceSek)
      const id = `pi_fake_${_piId++}`
      const clientSecret = `${id}_secret`
      created.push({ id, clientSecret, args, totalOre, applicationFeeOre })
      return { id, clientSecret }
    },

    async capture(paymentIntentId) {
      if (opts?.failCapture) throw opts.failCapture
      captured.push({ paymentIntentId })
    },

    async cancel(paymentIntentId, reason) {
      if (opts?.failCancel) throw opts.failCancel
      canceled.push({ paymentIntentId, reason })
    },
  }
}
