/**
 * Contract round-trip tests for the ENDPOINTS registry (RFC #39).
 *
 * One safeParse pass per endpoint — valid input passes, invalid input fails.
 * These tests catch shape drift between the registry definition and the
 * contracts without spinning up real Deno edge functions.
 */
import { describe, it, expect, vi } from 'vitest'
import { ENDPOINTS, createEndpointInvokers } from './endpoints'
import type { EdgeClient } from './edge'

// ---------------------------------------------------------------------------
// booking.create
// ---------------------------------------------------------------------------

describe("ENDPOINTS['booking.create']", () => {
  const def = ENDPOINTS['booking.create']

  it('request accepts valid paid-booking input', () => {
    const result = def.request.safeParse({
      marketTableId: 'table-1',
      fleaMarketId: 'market-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })
    expect(result.success).toBe(true)
  })

  it('request accepts input without optional message', () => {
    const result = def.request.safeParse({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(result.success).toBe(true)
  })

  it('request rejects empty marketTableId', () => {
    const result = def.request.safeParse({
      marketTableId: '',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(result.success).toBe(false)
  })

  it('request rejects invalid date format', () => {
    const result = def.request.safeParse({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '01/12/2026',
    })
    expect(result.success).toBe(false)
  })

  it('response accepts paid-booking output', () => {
    const result = def.response.safeParse({ bookingId: 'b-1', clientSecret: 'pi_xyz' })
    expect(result.success).toBe(true)
  })

  it('response accepts free-booking output (no clientSecret)', () => {
    const result = def.response.safeParse({ bookingId: 'b-free' })
    expect(result.success).toBe(true)
  })

  it('response rejects missing bookingId', () => {
    const result = def.response.safeParse({ clientSecret: 'x' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// stripe.payment.capture
// ---------------------------------------------------------------------------

describe("ENDPOINTS['stripe.payment.capture']", () => {
  const def = ENDPOINTS['stripe.payment.capture']

  it('request accepts valid bookingId', () => {
    const result = def.request.safeParse({ bookingId: 'b-abc' })
    expect(result.success).toBe(true)
  })

  it('request rejects empty bookingId', () => {
    const result = def.request.safeParse({ bookingId: '' })
    expect(result.success).toBe(false)
  })

  it('request rejects missing bookingId', () => {
    const result = def.request.safeParse({})
    expect(result.success).toBe(false)
  })

  it('response accepts { success: true }', () => {
    const result = def.response.safeParse({ success: true })
    expect(result.success).toBe(true)
  })

  it('response rejects { success: false }', () => {
    const result = def.response.safeParse({ success: false })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createEndpointInvokers integration
// ---------------------------------------------------------------------------

describe('createEndpointInvokers', () => {
  it('stripe.payment.capture — calls edge with correct path and parsed input', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true })
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const invokers = createEndpointInvokers(edge)

    const out = await invokers['stripe.payment.capture'].invoke({ bookingId: 'b-1' })

    expect(invoke).toHaveBeenCalledWith('stripe-payment-capture', { bookingId: 'b-1' })
    expect(out).toEqual({ success: true })
  })

  it('stripe.payment.capture — throws on invalid input (fail-fast)', async () => {
    const invoke = vi.fn()
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const invokers = createEndpointInvokers(edge)

    await expect(
      invokers['stripe.payment.capture'].invoke({ bookingId: '' } as never),
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('stripe.payment.capture — throws on malformed server response', async () => {
    const invoke = vi.fn().mockResolvedValue({ unexpected: 'field' })
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const invokers = createEndpointInvokers(edge)

    await expect(
      invokers['stripe.payment.capture'].invoke({ bookingId: 'b-1' }),
    ).rejects.toThrow()
  })

  it('booking.create — calls edge with correct path and parsed input', async () => {
    const invoke = vi.fn().mockResolvedValue({ bookingId: 'b-new' })
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const invokers = createEndpointInvokers(edge)

    const out = await invokers['booking.create'].invoke({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })

    expect(invoke).toHaveBeenCalledWith('booking-create', {
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(out).toEqual({ bookingId: 'b-new' })
  })
})
