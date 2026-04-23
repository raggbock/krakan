import { describe, it, expect, vi } from 'vitest'
import { createEndpointInvokers } from './endpoints'
import type { EdgeClient } from './edge'

function makeEdge(invokeImpl: (name: string, body?: unknown) => Promise<unknown>): EdgeClient {
  return {
    invoke: vi.fn(invokeImpl) as unknown as EdgeClient['invoke'],
  }
}

describe('createEndpointInvokers', () => {
  describe('booking.create', () => {
    it('invokes edge with the registered path and parsed input', async () => {
      const invoke = vi.fn().mockResolvedValue({ bookingId: 'b-1', clientSecret: 'pi_secret' })
      const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
      const invokers = createEndpointInvokers(edge)

      const out = await invokers['booking.create'].invoke({
        marketTableId: 'table-1',
        fleaMarketId: 'market-1',
        bookingDate: '2026-12-01',
        message: 'Hej',
      })

      expect(invoke).toHaveBeenCalledWith('booking-create', {
        marketTableId: 'table-1',
        fleaMarketId: 'market-1',
        bookingDate: '2026-12-01',
        message: 'Hej',
      })
      expect(out).toEqual({ bookingId: 'b-1', clientSecret: 'pi_secret' })
    })

    it('accepts a free-booking response without clientSecret', async () => {
      const edge = makeEdge(async () => ({ bookingId: 'b-free' }))
      const invokers = createEndpointInvokers(edge)
      const out = await invokers['booking.create'].invoke({
        marketTableId: 't',
        fleaMarketId: 'm',
        bookingDate: '2026-12-01',
      })
      expect(out).toEqual({ bookingId: 'b-free' })
    })

    it('throws on invalid client input (fail-fast, no round-trip)', async () => {
      const invoke = vi.fn()
      const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
      const invokers = createEndpointInvokers(edge)

      await expect(
        invokers['booking.create'].invoke({
          marketTableId: '',
          fleaMarketId: 'm',
          bookingDate: 'not-a-date',
        } as unknown as Parameters<typeof invokers['booking.create']['invoke']>[0]),
      ).rejects.toThrow()
      expect(invoke).not.toHaveBeenCalled()
    })

    it('throws when server returns a malformed response', async () => {
      const edge = makeEdge(async () => ({ wrongField: 'oops' }))
      const invokers = createEndpointInvokers(edge)
      await expect(
        invokers['booking.create'].invoke({
          marketTableId: 't',
          fleaMarketId: 'm',
          bookingDate: '2026-12-01',
        }),
      ).rejects.toThrow()
    })
  })

  describe('stripe.payment.cancel', () => {
    it('invokes edge with the registered path and parsed input', async () => {
      const invoke = vi.fn().mockResolvedValue({ success: true })
      const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
      const invokers = createEndpointInvokers(edge)

      const out = await invokers['stripe.payment.cancel'].invoke({
        bookingId: 'b-1',
        newStatus: 'denied',
      })

      expect(invoke).toHaveBeenCalledWith('stripe-payment-cancel', { bookingId: 'b-1', newStatus: 'denied' })
      expect(out).toEqual({ success: true })
    })
  })

  describe('stripe.connect.status', () => {
    it('invokes edge with the registered path', async () => {
      const invoke = vi.fn().mockResolvedValue({ connected: true, onboarding_complete: false })
      const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
      const invokers = createEndpointInvokers(edge)

      const out = await invokers['stripe.connect.status'].invoke({})

      expect(invoke).toHaveBeenCalledWith('stripe-connect-status', {})
      expect(out).toEqual({ connected: true, onboarding_complete: false })
    })
  })

  describe('organizer.stats', () => {
    it('invokes edge with organizer_id', async () => {
      const invoke = vi.fn().mockResolvedValue({ markets: [] })
      const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
      const invokers = createEndpointInvokers(edge)

      const out = await invokers['organizer.stats'].invoke({ organizer_id: 'user-1' })

      expect(invoke).toHaveBeenCalledWith('organizer-stats', { organizer_id: 'user-1' })
      expect(out).toEqual({ markets: [] })
    })
  })
})
