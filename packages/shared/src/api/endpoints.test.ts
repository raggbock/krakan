import { describe, it, expect, vi } from 'vitest'
import { createEndpointsApi } from './endpoints'
import type { EdgeClient } from './edge'

function makeEdge(invokeImpl: (name: string, body?: unknown) => Promise<unknown>): EdgeClient {
  return {
    invoke: vi.fn(invokeImpl) as unknown as EdgeClient['invoke'],
  }
}

describe('createEndpointsApi', () => {
  it('bookingCreate calls edge.invoke with the registered name and parsed input', async () => {
    const invoke = vi.fn().mockResolvedValue({ bookingId: 'b-1', clientSecret: 'pi_secret' })
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const api = createEndpointsApi(edge)

    const out = await api.bookingCreate({
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

  it('bookingCreate accepts a free-booking response without clientSecret', async () => {
    const edge = makeEdge(async () => ({ bookingId: 'b-free' }))
    const api = createEndpointsApi(edge)
    const out = await api.bookingCreate({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(out).toEqual({ bookingId: 'b-free' })
  })

  it('bookingCreate throws on invalid client input (fail-fast, no round-trip)', async () => {
    const invoke = vi.fn()
    const edge: EdgeClient = { invoke: invoke as unknown as EdgeClient['invoke'] }
    const api = createEndpointsApi(edge)

    await expect(
      api.bookingCreate({
        marketTableId: '',
        fleaMarketId: 'm',
        bookingDate: 'not-a-date',
      } as unknown as Parameters<typeof api.bookingCreate>[0]),
    ).rejects.toThrow()
    expect(invoke).not.toHaveBeenCalled()
  })

  it('bookingCreate throws when server returns a malformed response', async () => {
    const edge = makeEdge(async () => ({ wrongField: 'oops' }))
    const api = createEndpointsApi(edge)
    await expect(
      api.bookingCreate({
        marketTableId: 't',
        fleaMarketId: 'm',
        bookingDate: '2026-12-01',
      }),
    ).rejects.toThrow()
  })
})
