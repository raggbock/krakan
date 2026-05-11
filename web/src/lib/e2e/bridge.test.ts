import { describe, it, expect, beforeEach } from 'vitest'
import { createE2EBridge } from './bridge'
import { createE2EInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import type { StoredMarket } from '@fyndstigen/shared/adapters/in-memory/flea-markets'

function makeMarket(id: string, name = `M ${id}`): StoredMarket {
  return {
    id,
    name,
    organizerId: 'u1',
    isPermanent: true,
    publishedAt: '2024-01-01T00:00:00Z',
    isDeleted: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    street: 'Storgatan 1',
    zipCode: '12345',
    city: 'Göteborg',
    country: 'SE',
    latitude: 57.7,
    longitude: 11.97,
    autoAcceptBookings: false,
    description: '',
  }
}

describe('createE2EBridge', () => {
  let target: Window

  beforeEach(() => {
    target = { __E2E__: undefined, __E2E_NOW__: undefined } as unknown as Window
  })

  it('attaches seed/reset/setNow to the target', () => {
    const { control } = createE2EInMemoryDeps()
    createE2EBridge(control, target)
    expect(typeof target.__E2E__?.seed).toBe('function')
    expect(typeof target.__E2E__?.reset).toBe('function')
    expect(typeof target.__E2E__?.setNow).toBe('function')
  })

  it('seed() forwards to the deps control', async () => {
    const { deps, control } = createE2EInMemoryDeps()
    createE2EBridge(control, target)
    target.__E2E__!.seed([makeMarket('fm-1')])
    const { count } = await deps.markets.list()
    expect(count).toBe(1)
  })

  it('reset() clears markets and __E2E_NOW__', async () => {
    const { deps, control } = createE2EInMemoryDeps()
    createE2EBridge(control, target)
    target.__E2E__!.seed([makeMarket('fm-1')])
    target.__E2E__!.setNow('2026-04-23T12:00:00Z')
    target.__E2E__!.reset()
    expect((await deps.markets.list()).count).toBe(0)
    expect(target.__E2E_NOW__).toBeUndefined()
  })

  it('setNow() writes to target.__E2E_NOW__', () => {
    const { control } = createE2EInMemoryDeps()
    createE2EBridge(control, target)
    target.__E2E__!.setNow('2026-04-23T12:00:00Z')
    expect(target.__E2E_NOW__).toBe('2026-04-23T12:00:00Z')
  })
})
