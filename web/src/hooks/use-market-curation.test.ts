import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMarketCuration } from './use-market-curation'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'

function makeRow(overrides: Partial<AdminMarketRow> = {}): AdminMarketRow {
  return {
    id: 'row-1',
    slug: 'test-slug',
    name: 'Test Loppis',
    city: 'Stockholm',
    street: 'Testgatan 1',
    zipCode: '12345',
    country: 'SE',
    status: 'confirmed',
    category: null,
    isSystemOwned: false,
    isPublished: true,
    isPermanent: true,
    contactWebsite: 'https://example.com',
    contactFacebook: null,
    contactInstagram: null,
    contactPhone: '+46700000000',
    contactEmail: 'test@example.com',
    hasWebsite: true,
    hasFacebook: false,
    hasInstagram: false,
    hasPhone: true,
    hasEmail: true,
    hasOpeningHours: true,
    hasCoordinates: true,
    latitude: 59.3,
    longitude: 18.0,
    openingHourRules: [],
    takeover: null,
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

const row1 = makeRow({ id: 'r1', name: 'Alpha Loppis', city: 'Stockholm', isPublished: true, isSystemOwned: false, status: 'confirmed', updatedAt: '2024-03-01T00:00:00Z' })
const row2 = makeRow({ id: 'r2', name: 'Beta Loppis', city: 'Göteborg', isPublished: false, isSystemOwned: true, status: 'confirmed', updatedAt: '2024-01-01T00:00:00Z' })
const row3 = makeRow({ id: 'r3', name: 'Gamma Loppis', city: 'Malmö', isPublished: true, isSystemOwned: true, status: 'closed', updatedAt: '2024-02-01T00:00:00Z' })
const rows = [row1, row2, row3]

describe('useMarketCuration', () => {
  it('returns all non-closed rows by default', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('filter unpublished shows only unpublished non-closed rows', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setFilter('unpublished') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r2'])
  })

  it('filter system_owned shows only system-owned rows', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setFilter('system_owned') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r2'])
  })

  it('filter claimed shows only non-system-owned rows', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setFilter('claimed') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r1'])
  })

  it('filter closed reveals closed rows', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setFilter('closed') })
    expect(result.current.filtered.map((r) => r.id)).toContain('r3')
  })

  it('filter unverified shows unverified rows', () => {
    const unverifiedRow = makeRow({ id: 'r4', name: 'Delta', status: 'unverified', isPublished: false })
    const { result } = renderHook(() => useMarketCuration([row1, unverifiedRow]))
    act(() => { result.current.setFilter('unverified') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r4'])
  })

  it('filter missing_coords shows rows without coordinates', () => {
    const noCoords = makeRow({ id: 'r5', name: 'Epsilon', hasCoordinates: false })
    const { result } = renderHook(() => useMarketCuration([row1, noCoords]))
    act(() => { result.current.setFilter('missing_coords') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r5'])
  })

  it('filter has_coords shows rows with coordinates', () => {
    const noCoords = makeRow({ id: 'r5', name: 'Epsilon', hasCoordinates: false })
    const { result } = renderHook(() => useMarketCuration([row1, noCoords]))
    act(() => { result.current.setFilter('has_coords') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r1'])
  })

  it('filter missing_email shows rows without email', () => {
    const noEmail = makeRow({ id: 'r6', name: 'Zeta', hasEmail: false })
    const { result } = renderHook(() => useMarketCuration([row1, noEmail]))
    act(() => { result.current.setFilter('missing_email') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r6'])
  })

  it('setFilter toggles off when called again with same filter', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setFilter('unpublished') })
    act(() => { result.current.setFilter('unpublished') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  it('search filters by name', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setSearch('alpha') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r1'])
  })

  it('search filters by city', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setSearch('göteborg') })
    expect(result.current.filtered.map((r) => r.id)).toEqual(['r2'])
  })

  it('sort by name ascending', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setSort('name', 'asc') })
    const names = result.current.filtered.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'sv')))
  })

  it('sort by name descending', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.setSort('name', 'desc') })
    const names = result.current.filtered.map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a, 'sv')))
  })

  it('sort by updated descending by default', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    const ids = result.current.filtered.map((r) => r.id)
    expect(ids[0]).toBe('r1')
  })

  it('toggleSelection adds to selection', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.toggleSelection('r1', true) })
    expect(result.current.selection.has('r1')).toBe(true)
  })

  it('toggleSelection removes from selection', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.toggleSelection('r1', true) })
    act(() => { result.current.toggleSelection('r1', false) })
    expect(result.current.selection.has('r1')).toBe(false)
  })

  it('selectAll adds all filtered ids', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.selectAll() })
    expect(result.current.selection.has('r1')).toBe(true)
    expect(result.current.selection.has('r2')).toBe(true)
    expect(result.current.selection.has('r3')).toBe(false)
  })

  it('clearSelection empties selection', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    act(() => { result.current.toggleSelection('r1', true) })
    act(() => { result.current.clearSelection() })
    expect(result.current.selection.size).toBe(0)
  })

  it('counts reflects non-closed rows', () => {
    const { result } = renderHook(() => useMarketCuration(rows))
    expect(result.current.counts.total).toBe(3)
    expect(result.current.counts.unpublished).toBe(1)
    expect(result.current.counts.systemOwned).toBe(2)
    expect(result.current.counts.claimed).toBe(1)
  })
})
