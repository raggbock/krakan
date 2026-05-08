import { describe, it, expect } from 'vitest'
import { optimizeRoute, type Stop } from '@fyndstigen/shared'

describe('optimizeRoute', () => {
  it('returns empty array for empty input', () => {
    expect(optimizeRoute([])).toEqual([])
  })

  it('returns same array for single stop', () => {
    const stops: Stop[] = [{ id: 'a', lat: 59.33, lng: 18.07 }]
    expect(optimizeRoute(stops)).toEqual(stops)
  })

  it('returns same array for two stops (only one possible order)', () => {
    const stops: Stop[] = [
      { id: 'a', lat: 59.33, lng: 18.07 },
      { id: 'b', lat: 59.34, lng: 18.08 },
    ]
    const result = optimizeRoute(stops)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('reorders stops to nearest-neighbor from first stop', () => {
    // A is in Stockholm, B is in Malmö, C is in Uppsala (near Stockholm)
    const stops: Stop[] = [
      { id: 'stockholm', lat: 59.33, lng: 18.07 },
      { id: 'malmö', lat: 55.6, lng: 13.0 },
      { id: 'uppsala', lat: 59.86, lng: 17.64 },
    ]
    const result = optimizeRoute(stops)
    // From Stockholm, Uppsala is closer than Malmö
    expect(result.map((s) => s.id)).toEqual(['stockholm', 'uppsala', 'malmö'])
  })

  it('uses custom start point when provided', () => {
    // Start from Uppsala — Uppsala market should be first
    const stops: Stop[] = [
      { id: 'stockholm', lat: 59.33, lng: 18.07 },
      { id: 'malmö', lat: 55.6, lng: 13.0 },
      { id: 'uppsala', lat: 59.86, lng: 17.64 },
    ]
    const result = optimizeRoute(stops, { lat: 59.86, lng: 17.64 })
    expect(result[0].id).toBe('uppsala')
    expect(result[1].id).toBe('stockholm')
    expect(result[2].id).toBe('malmö')
  })

  it('handles stops at the same location', () => {
    const stops: Stop[] = [
      { id: 'a', lat: 59.33, lng: 18.07 },
      { id: 'b', lat: 59.33, lng: 18.07 },
      { id: 'c', lat: 59.33, lng: 18.07 },
    ]
    const result = optimizeRoute(stops)
    expect(result).toHaveLength(3)
  })

  it('does not mutate the original array', () => {
    const stops: Stop[] = [
      { id: 'stockholm', lat: 59.33, lng: 18.07 },
      { id: 'malmö', lat: 55.6, lng: 13.0 },
      { id: 'uppsala', lat: 59.86, lng: 17.64 },
    ]
    const copy = [...stops]
    optimizeRoute(stops)
    expect(stops).toEqual(copy)
  })

  it('handles a larger set of stops', () => {
    const stops: Stop[] = [
      { id: 'göteborg', lat: 57.71, lng: 11.97 },
      { id: 'stockholm', lat: 59.33, lng: 18.07 },
      { id: 'malmö', lat: 55.6, lng: 13.0 },
      { id: 'linköping', lat: 58.41, lng: 15.63 },
      { id: 'örebro', lat: 59.27, lng: 15.21 },
    ]
    const result = optimizeRoute(stops)
    // Should visit all stops exactly once
    expect(result).toHaveLength(5)
    expect(new Set(result.map((s) => s.id)).size).toBe(5)
    // First stop should be the original first stop (Göteborg)
    expect(result[0].id).toBe('göteborg')
  })
})
