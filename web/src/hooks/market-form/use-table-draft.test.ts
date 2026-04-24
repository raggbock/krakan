import { renderHook, act } from '@testing-library/react'
import { useTableDraft } from './use-table-draft'
import type { MarketTable } from '@/lib/api'

const dbTable: MarketTable = {
  id: 't-1',
  flea_market_id: 'mkt-1',
  label: 'Bord 1',
  description: 'Stort bord',
  price_sek: 200,
  size_description: '2x1m',
}

describe('useTableDraft', () => {
  it('initialises from existing DB tables', () => {
    const { result } = renderHook(() => useTableDraft([dbTable]))
    expect(result.current.existingTables).toHaveLength(1)
    expect(result.current.existingTables[0].label).toBe('Bord 1')
    expect(result.current.existingTables[0].priceSek).toBe(200)
  })

  it('addBatch appends new table drafts', () => {
    const { result } = renderHook(() => useTableDraft())
    act(() => result.current.addBatch([{ label: 'Bord 2', description: '', priceSek: 100, sizeDescription: '1x1m' }]))
    expect(result.current.newTables).toHaveLength(1)
    expect(result.current.newTables[0].label).toBe('Bord 2')
  })

  it('removeNew removes by index', () => {
    const { result } = renderHook(() => useTableDraft())
    act(() => result.current.addBatch([
      { label: 'A', description: '', priceSek: 0, sizeDescription: '' },
      { label: 'B', description: '', priceSek: 0, sizeDescription: '' },
    ]))
    act(() => result.current.removeNew(0))
    expect(result.current.newTables).toHaveLength(1)
    expect(result.current.newTables[0].label).toBe('B')
  })

  it('markDeleted sets _deleted on existing table', () => {
    const { result } = renderHook(() => useTableDraft([dbTable]))
    act(() => result.current.markDeleted('t-1'))
    expect(result.current.existingTables[0]._deleted).toBe(true)
  })

  it('undoDelete clears _deleted', () => {
    const { result } = renderHook(() => useTableDraft([dbTable]))
    act(() => {
      result.current.markDeleted('t-1')
      result.current.undoDelete('t-1')
    })
    expect(result.current.existingTables[0]._deleted).toBe(false)
  })

  it('serialize: add=newTables, remove=deleted existing ids', () => {
    const { result } = renderHook(() => useTableDraft([dbTable]))
    act(() => {
      result.current.markDeleted('t-1')
      result.current.addBatch([{ label: 'Ny', description: '', priceSek: 50, sizeDescription: '' }])
    })
    const s = result.current.serialize()
    expect(s.add).toHaveLength(1)
    expect(s.add[0].label).toBe('Ny')
    expect(s.remove).toEqual(['t-1'])
  })

  it('returned object is stable across renders when state unchanged', () => {
    const { result, rerender } = renderHook(() => useTableDraft([dbTable]))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
