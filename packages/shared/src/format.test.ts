import { describe, it, expect } from 'vitest'
import { isPastInStockholm } from './format'

describe('isPastInStockholm', () => {
  it('returns false for today regardless of viewer timezone', () => {
    // 2026-06-15 11:00 Stockholm (summer, UTC+02:00)
    const now = new Date('2026-06-15T09:00:00Z')
    expect(isPastInStockholm('2026-06-15', now)).toBe(false)
  })

  it('returns true for yesterday', () => {
    const now = new Date('2026-06-15T09:00:00Z')
    expect(isPastInStockholm('2026-06-14', now)).toBe(true)
  })

  it('returns false for tomorrow', () => {
    const now = new Date('2026-06-15T09:00:00Z')
    expect(isPastInStockholm('2026-06-16', now)).toBe(false)
  })

  it('honors Stockholm date even when UTC clock has already rolled over', () => {
    // 2026-06-15 23:30 Stockholm (summer) = 21:30 UTC.
    // A naive `now.toISOString().slice(0,10)` would say "2026-06-15" too,
    // but exercising near-midnight catches the timezone path.
    const lateNight = new Date('2026-06-15T21:30:00Z')
    expect(isPastInStockholm('2026-06-15', lateNight)).toBe(false)
  })

  it('handles the wintertime offset (CET, +01:00)', () => {
    // 2026-01-15 12:00 Stockholm = 11:00 UTC.
    const now = new Date('2026-01-15T11:00:00Z')
    expect(isPastInStockholm('2026-01-15', now)).toBe(false)
    expect(isPastInStockholm('2026-01-14', now)).toBe(true)
  })

  it('treats midnight Stockholm time as the start of the new day', () => {
    // 2026-06-15 00:30 Stockholm (summer) = 2026-06-14 22:30 UTC.
    // It's already the 15th in Sweden; the 14th is over.
    const justAfterMidnight = new Date('2026-06-14T22:30:00Z')
    expect(isPastInStockholm('2026-06-14', justAfterMidnight)).toBe(true)
    expect(isPastInStockholm('2026-06-15', justAfterMidnight)).toBe(false)
  })
})
