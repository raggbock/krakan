/**
 * Contract tests for BookingStripeGateway against the fake adapter.
 *
 * These tests verify:
 *  - Idempotency key is passed through verbatim
 *  - Application-fee math matches calculateStripeAmounts
 *  - capture_method is forwarded correctly
 *  - Errors from Stripe propagate as thrown exceptions
 */
import { describe, it, expect } from 'vitest'
import { createFakeBookingStripeGateway } from './booking-stripe-gateway'
import { calculateStripeAmounts } from '../../booking'

const baseArgs = {
  priceSek: 200,
  stripeAccountId: 'acct_test',
  captureMethod: 'manual' as const,
  idempotencyKey: 'user-1-mt-1-2026-06-01-12345',
  metadata: {
    market_table_id: 'mt-1',
    flea_market_id: 'fm-1',
    booked_by: 'user-1',
    booking_date: '2026-06-01',
  },
}

describe('createPaymentIntentWithFees', () => {
  it('returns id and clientSecret', async () => {
    const gateway = createFakeBookingStripeGateway()
    const result = await gateway.createPaymentIntentWithFees(baseArgs)
    expect(result.id).toMatch(/^pi_fake_/)
    expect(result.clientSecret).toContain(result.id)
  })

  it('records the call', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees(baseArgs)
    expect(gateway.created).toHaveLength(1)
  })

  it('forwards idempotency key verbatim', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees(baseArgs)
    expect(gateway.created[0].args.idempotencyKey).toBe(baseArgs.idempotencyKey)
  })

  it('application-fee matches calculateStripeAmounts', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees(baseArgs)
    const { applicationFeeOre, totalOre } = calculateStripeAmounts(baseArgs.priceSek)
    expect(gateway.created[0].applicationFeeOre).toBe(applicationFeeOre)
    expect(gateway.created[0].totalOre).toBe(totalOre)
  })

  it('capture_method is forwarded — manual', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees({ ...baseArgs, captureMethod: 'manual' })
    expect(gateway.created[0].args.captureMethod).toBe('manual')
  })

  it('capture_method is forwarded — automatic', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees({ ...baseArgs, captureMethod: 'automatic' })
    expect(gateway.created[0].args.captureMethod).toBe('automatic')
  })

  it('application-fee math for large price (300 SEK)', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.createPaymentIntentWithFees({ ...baseArgs, priceSek: 300 })
    const { applicationFeeOre, totalOre } = calculateStripeAmounts(300)
    expect(gateway.created[0].applicationFeeOre).toBe(applicationFeeOre) // 36 * 100 = 3600
    expect(gateway.created[0].totalOre).toBe(totalOre) // (300 + 36) * 100 = 33600
  })

  it('throws when gateway fails', async () => {
    const gateway = createFakeBookingStripeGateway({ failCreate: new Error('Stripe down') })
    await expect(gateway.createPaymentIntentWithFees(baseArgs)).rejects.toThrow('Stripe down')
  })
})

describe('capture', () => {
  it('records the captured payment intent id', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.capture('pi_abc')
    expect(gateway.captured).toHaveLength(1)
    expect(gateway.captured[0].paymentIntentId).toBe('pi_abc')
  })

  it('throws when gateway fails', async () => {
    const gateway = createFakeBookingStripeGateway({ failCapture: new Error('Capture failed') })
    await expect(gateway.capture('pi_abc')).rejects.toThrow('Capture failed')
  })
})

describe('cancel', () => {
  it('records the canceled payment intent id', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.cancel('pi_abc')
    expect(gateway.canceled).toHaveLength(1)
    expect(gateway.canceled[0].paymentIntentId).toBe('pi_abc')
  })

  it('forwards cancellation reason', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.cancel('pi_abc', 'duplicate')
    expect(gateway.canceled[0].reason).toBe('duplicate')
  })

  it('reason is optional', async () => {
    const gateway = createFakeBookingStripeGateway()
    await gateway.cancel('pi_abc')
    expect(gateway.canceled[0].reason).toBeUndefined()
  })

  it('throws when gateway fails', async () => {
    const gateway = createFakeBookingStripeGateway({ failCancel: new Error('Cancel failed') })
    await expect(gateway.cancel('pi_abc')).rejects.toThrow('Cancel failed')
  })
})
