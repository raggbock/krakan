import { describe, it, expect, beforeEach } from 'vitest'
import {
  DRAFT_KEY,
  addStopToDraft,
  isMarketInDraft,
  readDraft,
  writeDraft,
} from './draft'

function makeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v)
    },
    removeItem: (k) => {
      data.delete(k)
    },
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

describe('addStopToDraft', () => {
  let storage: Storage

  beforeEach(() => {
    storage = makeStorage()
  })

  it('initializes a new draft when none exists', () => {
    const { draft, added } = addStopToDraft(storage, 'market-1', () => 1000)
    expect(added).toBe(true)
    expect(draft.stops).toEqual([{ marketId: 'market-1', index: 0 }])
    expect(draft.name).toBe('')
    expect(draft.useGps).toBe(true)
  })

  it('appends to an existing draft', () => {
    addStopToDraft(storage, 'market-1', () => 1000)
    const { draft, added } = addStopToDraft(storage, 'market-2', () => 2000)
    expect(added).toBe(true)
    expect(draft.stops).toEqual([
      { marketId: 'market-1', index: 0 },
      { marketId: 'market-2', index: 1 },
    ])
  })

  it('is idempotent — same marketId returns added=false', () => {
    addStopToDraft(storage, 'market-1', () => 1000)
    const { draft, added } = addStopToDraft(storage, 'market-1', () => 2000)
    expect(added).toBe(false)
    expect(draft.stops).toHaveLength(1)
  })

  it('persists the draft so readDraft picks it up', () => {
    addStopToDraft(storage, 'market-1', () => 1000)
    const draft = readDraft(storage, () => 2000)
    expect(draft?.stops).toEqual([{ marketId: 'market-1', index: 0 }])
  })

  it('preserves existing draft fields (name, plannedDate, useGps) when appending', () => {
    writeDraft(storage, {
      name: 'Söndagsrundan',
      plannedDate: '2026-06-01',
      useGps: false,
      customStart: { lat: 59.3, lng: 18.1 },
      stops: [{ marketId: 'market-1', index: 0 }],
      savedAt: new Date(1000).toISOString(),
    })
    const { draft } = addStopToDraft(storage, 'market-2', () => 2000)
    expect(draft.name).toBe('Söndagsrundan')
    expect(draft.plannedDate).toBe('2026-06-01')
    expect(draft.useGps).toBe(false)
    expect(draft.customStart).toEqual({ lat: 59.3, lng: 18.1 })
  })
})

describe('isMarketInDraft', () => {
  it('returns false when no draft exists', () => {
    expect(isMarketInDraft(makeStorage(), 'market-1')).toBe(false)
  })

  it('returns true when the market is in the draft', () => {
    const storage = makeStorage()
    addStopToDraft(storage, 'market-1', () => 1000)
    expect(isMarketInDraft(storage, 'market-1', () => 2000)).toBe(true)
  })

  it('returns false for markets not in the draft', () => {
    const storage = makeStorage()
    addStopToDraft(storage, 'market-1', () => 1000)
    expect(isMarketInDraft(storage, 'market-2', () => 2000)).toBe(false)
  })

  it('returns false when the draft has expired', () => {
    const storage = makeStorage()
    addStopToDraft(storage, 'market-1', () => 1000)
    const eightDaysLater = 1000 + 8 * 24 * 60 * 60 * 1000
    expect(isMarketInDraft(storage, 'market-1', () => eightDaysLater)).toBe(false)
  })
})
