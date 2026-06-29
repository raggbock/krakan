import { describe, it, expect } from 'vitest'
import {
  canonicalCity,
  rawLabelsFor,
  DISTRICT_SLUG_TO_PARENT_SLUG,
  CITY_ALIASES,
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
