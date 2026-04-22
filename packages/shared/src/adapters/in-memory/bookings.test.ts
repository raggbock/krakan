import { describe, it, expect } from 'vitest'
import { createInMemoryBookings } from './bookings'

const basePayload = {
  marketTableId: 'mt-1',
  fleaMarketId: 'fm-1',
  bookedBy: 'user-1',
  bookingDate: '2026-06-01',
  priceSek: 200,
}

describe('createInMemoryBookings', () => {
  it('create-then-listByUser returns what was stored', async () => {
    const repo = createInMemoryBookings()
    await repo.create(basePayload)
    const bookings = await repo.listByUser('user-1')
    expect(bookings).toHaveLength(1)
    expect(bookings[0].booked_by).toBe('user-1')
    expect(bookings[0].market_table_id).toBe('mt-1')
    expect(bookings[0].booking_date).toBe('2026-06-01')
    expect(bookings[0].status).toBe('pending')
  })

  it('listByUser only returns that user\'s bookings', async () => {
    const repo = createInMemoryBookings()
    await repo.create(basePayload)
    await repo.create({ ...basePayload, bookedBy: 'user-2' })
    const u1 = await repo.listByUser('user-1')
    const u2 = await repo.listByUser('user-2')
    expect(u1).toHaveLength(1)
    expect(u2).toHaveLength(1)
  })

  it('listByMarket returns pending and confirmed bookings', async () => {
    const repo = createInMemoryBookings()
    const { id } = await repo.create(basePayload)
    // starts as pending
    const pending = await repo.listByMarket('fm-1')
    expect(pending).toHaveLength(1)

    await repo.updateStatus(id, 'confirmed')
    const confirmed = await repo.listByMarket('fm-1')
    expect(confirmed).toHaveLength(1)

    await repo.updateStatus(id, 'cancelled')
    const cancelled = await repo.listByMarket('fm-1')
    expect(cancelled).toHaveLength(0)
  })

  it('updateStatus transitions booking status correctly', async () => {
    const repo = createInMemoryBookings()
    const { id } = await repo.create(basePayload)
    await repo.updateStatus(id, 'confirmed', 'Välkommen!')
    const bookings = await repo.listByMarket('fm-1')
    expect(bookings[0].status).toBe('confirmed')
    expect(bookings[0].organizerNote).toBe('Välkommen!')
  })

  it('updateStatus throws on invalid transition', async () => {
    const repo = createInMemoryBookings()
    const { id } = await repo.create(basePayload)
    await repo.updateStatus(id, 'confirmed')
    await expect(repo.updateStatus(id, 'confirmed')).rejects.toThrow()
  })

  it('availableDates returns booked dates for pending/confirmed', async () => {
    const repo = createInMemoryBookings()
    await repo.create({ ...basePayload, bookingDate: '2026-06-01' })
    await repo.create({ ...basePayload, bookingDate: '2026-06-02' })
    const dates = await repo.availableDates('mt-1')
    expect(dates).toContain('2026-06-01')
    expect(dates).toContain('2026-06-02')
    expect(dates).toHaveLength(2)
  })
})
