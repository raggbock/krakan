import { describe, it, expect } from 'vitest'
import { BookingCreateInput, BookingCreateOutput } from './booking-create'

describe('BookingCreateInput', () => {
  it('accepts a valid paid-booking input', () => {
    const parsed = BookingCreateInput.parse({
      marketTableId: 'table-1',
      fleaMarketId: 'market-1',
      bookingDate: '2026-12-01',
      message: 'Hej',
    })
    expect(parsed.message).toBe('Hej')
  })

  it('accepts input without message', () => {
    const parsed = BookingCreateInput.parse({
      marketTableId: 't',
      fleaMarketId: 'm',
      bookingDate: '2026-12-01',
    })
    expect(parsed.message).toBeUndefined()
  })

  it('rejects invalid date format', () => {
    expect(() =>
      BookingCreateInput.parse({
        marketTableId: 't',
        fleaMarketId: 'm',
        bookingDate: '2026/12/01',
      }),
    ).toThrow()
  })

  it('rejects empty marketTableId', () => {
    expect(() =>
      BookingCreateInput.parse({
        marketTableId: '',
        fleaMarketId: 'm',
        bookingDate: '2026-12-01',
      }),
    ).toThrow()
  })
})

describe('BookingCreateOutput', () => {
  it('accepts paid-booking output with clientSecret', () => {
    const parsed = BookingCreateOutput.parse({
      bookingId: 'b-1',
      clientSecret: 'pi_xyz_secret',
    })
    expect(parsed.clientSecret).toBe('pi_xyz_secret')
  })

  it('accepts free-booking output without clientSecret', () => {
    const parsed = BookingCreateOutput.parse({ bookingId: 'b-2' })
    expect(parsed.bookingId).toBe('b-2')
    expect(parsed.clientSecret).toBeUndefined()
  })

  it('rejects missing bookingId', () => {
    expect(() => BookingCreateOutput.parse({ clientSecret: 'x' })).toThrow()
  })

  it('round-trips through JSON', () => {
    const sample = { bookingId: 'b-3', clientSecret: 'pi_abc' }
    const parsed = BookingCreateOutput.parse(JSON.parse(JSON.stringify(sample)))
    expect(parsed).toEqual(sample)
  })
})
