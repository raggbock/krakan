import { describe, it, expect } from 'vitest'
import {
  canonicalCity,
  rawLabelsFor,
  DISTRICT_SLUG_TO_PARENT_SLUG,
  CITY_ALIASES,
  aggregateCitiesByCanonical,
  canonicalizeNearbyCities,
} from './city-aliases'

describe('canonicalCity', () => {
  it('folds a Stockholm district into Stockholm', () => {
    expect(canonicalCity('Södermalm')).toBe('Stockholm')
    expect(canonicalCity('Vasastaden')).toBe('Stockholm')
  })
  it('folds Göteborg and Malmö districts', () => {
    expect(canonicalCity('Masthugget')).toBe('Göteborg')
    expect(canonicalCity('Limhamn')).toBe('Malmö')
  })
  it('does NOT fold separate municipalities', () => {
    expect(canonicalCity('Nacka')).toBe('Nacka')
    expect(canonicalCity('Solna')).toBe('Solna')
    expect(canonicalCity('Råsunda')).toBe('Råsunda')
    expect(canonicalCity('Mölndal')).toBe('Mölndal')
    expect(canonicalCity('Lund')).toBe('Lund')
  })
  it('is identity for an unknown city', () => {
    expect(canonicalCity('Vimmerby')).toBe('Vimmerby')
  })
})

describe('rawLabelsFor', () => {
  it('returns every raw label that folds into the canonical city', () => {
    const all = ['Stockholm', 'Södermalm', 'Nacka', 'Vasastaden', 'Göteborg']
    expect(rawLabelsFor('Stockholm', all).sort()).toEqual(
      ['Stockholm', 'Södermalm', 'Vasastaden'].sort(),
    )
  })
})

describe('aggregateCitiesByCanonical', () => {
  it('rolls district rows up under the parent and records raw labels', () => {
    const rows = [
      { city: 'Stockholm', updatedAt: '2026-06-01' },
      { city: 'Södermalm', updatedAt: '2026-06-10' },
      { city: 'Vasastaden', updatedAt: '2026-06-05' },
      { city: 'Nacka', updatedAt: '2026-06-02' },
      { city: null, updatedAt: '2026-06-09' },
    ]
    const out = aggregateCitiesByCanonical(rows)
    const sthlm = out.find((c) => c.city === 'Stockholm')!
    expect(sthlm.marketCount).toBe(3)
    expect(sthlm.latestUpdate).toBe('2026-06-10') // newest across the group
    expect(sthlm.rawLabels.sort()).toEqual(['Stockholm', 'Södermalm', 'Vasastaden'].sort())
    const nacka = out.find((c) => c.city === 'Nacka')!
    expect(nacka.marketCount).toBe(1)
    expect(nacka.rawLabels).toEqual(['Nacka'])
    expect(out.find((c) => c.city === 'Södermalm')).toBeUndefined() // folded away
  })
})

describe('canonicalizeNearbyCities', () => {
  it('folds districts, merges counts, keeps nearest distance, drops the target', () => {
    const rows = [
      { city: 'Södermalm', marketCount: 7, distanceKm: 2 },
      { city: 'Vasastaden', marketCount: 9, distanceKm: 4 },
      { city: 'Nacka', marketCount: 3, distanceKm: 8 },
      { city: 'Stockholm', marketCount: 37, distanceKm: 1 },
    ]
    // target is Stockholm — its own canonical (incl. districts) must be removed
    const out = canonicalizeNearbyCities(rows, 'Stockholm')
    expect(out.find((c) => c.city === 'Stockholm')).toBeUndefined()
    expect(out.find((c) => c.city === 'Södermalm')).toBeUndefined()
    const nacka = out.find((c) => c.city === 'Nacka')!
    expect(nacka.marketCount).toBe(3)
  })
  it('merges two districts of the same nearby parent into one entry', () => {
    const rows = [
      { city: 'Masthugget', marketCount: 5, distanceKm: 3 },
      { city: 'Eriksberg', marketCount: 2, distanceKm: 6 },
    ]
    const out = canonicalizeNearbyCities(rows, 'Kungälv')
    const gbg = out.find((c) => c.city === 'Göteborg')!
    expect(gbg.marketCount).toBe(7)
    expect(gbg.distanceKm).toBe(3) // nearest of the merged group
  })
})

describe('skiftlägesokänslig ortsammanslagning', () => {
  it('folds a district regardless of casing', () => {
    expect(canonicalCity('södermalm')).toBe('Stockholm')
    expect(canonicalCity('SÖDERMALM')).toBe('Stockholm')
  })

  it('merges casing variants into one city with all raw labels', () => {
    const rows = [
      { city: 'Upplands väsby', updatedAt: '2026-01-01' },
      { city: 'Upplands Väsby', updatedAt: '2026-01-02' },
    ]
    const result = aggregateCitiesByCanonical(rows)
    expect(result).toHaveLength(1)
    expect(result[0].marketCount).toBe(2)
    expect(result[0].rawLabels.sort()).toEqual(['Upplands Väsby', 'Upplands väsby'])
  })

  it('picks the properly-cased label as the display name', () => {
    const rows = [
      { city: 'Upplands väsby', updatedAt: '2026-01-01' },
      { city: 'Upplands Väsby', updatedAt: '2026-01-02' },
    ]
    expect(aggregateCitiesByCanonical(rows)[0].city).toBe('Upplands Väsby')
  })

  it('picks the most frequent label when casing differs', () => {
    const rows = [
      { city: 'nora', updatedAt: '2026-01-01' },
      { city: 'nora', updatedAt: '2026-01-02' },
      { city: 'Nora', updatedAt: '2026-01-03' },
    ]
    expect(aggregateCitiesByCanonical(rows)[0].city).toBe('nora')
  })

  it('keeps distinct cities distinct', () => {
    const rows = [
      { city: 'Nora', updatedAt: '2026-01-01' },
      { city: 'Norra Djurgården', updatedAt: '2026-01-02' },
    ]
    const cities = aggregateCitiesByCanonical(rows).map((r) => r.city).sort()
    expect(cities).toEqual(['Nora', 'Stockholm'])
  })

  it('rawLabelsFor collects casing variants', () => {
    const labels = ['Upplands Väsby', 'Upplands väsby', 'Nora']
    expect(rawLabelsFor('Upplands Väsby', labels).sort()).toEqual([
      'Upplands Väsby',
      'Upplands väsby',
    ])
  })

  it('canonicalizeNearbyCities excludes a casing variant of the target city', () => {
    const rows = [
      { city: 'Upplands väsby', marketCount: 2, distanceKm: 0 },
      { city: 'Nora', marketCount: 3, distanceKm: 8 },
    ]
    const out = canonicalizeNearbyCities(rows, 'Upplands Väsby')
    expect(out.find((c) => c.city === 'Upplands väsby')).toBeUndefined()
    expect(out.find((c) => c.city === 'Nora')).toBeDefined()
  })
})

describe('DISTRICT_SLUG_TO_PARENT_SLUG', () => {
  it('maps a district slug to its parent slug', () => {
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['sodermalm']).toBe('stockholm')
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['masthugget']).toBe('goteborg')
  })
  it('has no separate town as a key', () => {
    expect(DISTRICT_SLUG_TO_PARENT_SLUG['nacka']).toBeUndefined()
  })
  it('every alias value is a real parent city used as a value', () => {
    const parents = new Set(Object.values(CITY_ALIASES))
    expect(parents).toEqual(new Set(['Stockholm', 'Göteborg', 'Malmö']))
  })
})
