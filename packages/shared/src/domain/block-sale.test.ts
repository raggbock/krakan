import { describe, it, expect } from 'vitest'
import {
  generateBlockSaleSlug,
  expandEventDates,
  canTransitionStandStatus,
  validateBlockSaleInput,
} from './block-sale'

describe('generateBlockSaleSlug', () => {
  it('lowercases and dashes name + city + start_date', () => {
    expect(generateBlockSaleSlug('Rådmansgatan', 'Örebro', '2026-07-12'))
      .toBe('radmansgatan-orebro-2026-07-12')
  })
  it('strips diacritics', () => {
    expect(generateBlockSaleSlug('Sjöstaden', 'Göteborg', '2026-08-01'))
      .toBe('sjostaden-goteborg-2026-08-01')
  })
  it('truncates very long names', () => {
    const s = generateBlockSaleSlug('a'.repeat(100), 'Stockholm', '2026-01-01')
    expect(s.length).toBeLessThanOrEqual(80)
  })
})

describe('expandEventDates', () => {
  it('returns one date for single-day event', () => {
    expect(expandEventDates('2026-07-12', '2026-07-12')).toEqual(['2026-07-12'])
  })
  it('returns range for multi-day event', () => {
    expect(expandEventDates('2026-07-12', '2026-07-14')).toEqual(['2026-07-12', '2026-07-13', '2026-07-14'])
  })
  it('throws on inverted range', () => {
    expect(() => expandEventDates('2026-07-14', '2026-07-12')).toThrow()
  })
})

describe('canTransitionStandStatus', () => {
  it('allows pending → confirmed', () => {
    expect(canTransitionStandStatus('pending', 'confirmed')).toBe(true)
  })
  it('allows confirmed → approved', () => {
    expect(canTransitionStandStatus('confirmed', 'approved')).toBe(true)
  })
  it('allows confirmed → rejected', () => {
    expect(canTransitionStandStatus('confirmed', 'rejected')).toBe(true)
  })
  it('forbids pending → approved', () => {
    expect(canTransitionStandStatus('pending', 'approved')).toBe(false)
  })
  it('forbids approved → pending', () => {
    expect(canTransitionStandStatus('approved', 'pending')).toBe(false)
  })
})

describe('validateBlockSaleInput', () => {
  const valid = {
    name: 'Kvartersloppis Rådmansgatan',
    description: 'Stort kvartersloppis med många stånd',
    startDate: '2099-07-12',
    endDate: '2099-07-12',
    dailyOpen: '10:00',
    dailyClose: '15:00',
    city: 'Örebro',
  }
  it('passes valid input', () => {
    expect(validateBlockSaleInput(valid).ok).toBe(true)
  })
  it('rejects start_date in past', () => {
    expect(validateBlockSaleInput({ ...valid, startDate: '2020-01-01', endDate: '2020-01-01' }).ok).toBe(false)
  })
  it('rejects end before start', () => {
    expect(validateBlockSaleInput({ ...valid, endDate: '2099-07-10' }).ok).toBe(false)
  })
  it('rejects close <= open', () => {
    expect(validateBlockSaleInput({ ...valid, dailyClose: '10:00' }).ok).toBe(false)
  })
})
