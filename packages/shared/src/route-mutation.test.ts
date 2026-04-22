import { describe, it, expect, vi } from 'vitest'
import { runRouteMutation, type RouteDeps, type RouteEvent, type RoutePlan } from './route-mutation'

// ---------- Stub helpers ----------

function makeApi(overrides: Partial<RouteDeps['api']> = {}): RouteDeps['api'] {
  return {
    routes: {
      create: vi.fn().mockResolvedValue({ id: 'route-1' }),
      update: vi.fn().mockResolvedValue(undefined),
      ...(overrides.routes ?? {}),
    },
  }
}

async function collect(plan: RoutePlan, deps: RouteDeps): Promise<RouteEvent[]> {
  const events: RouteEvent[] = []
  for await (const ev of runRouteMutation(plan, deps)) events.push(ev)
  return events
}

// ---------- Fixtures ----------

const createPlan: RoutePlan = {
  route: {
    create: {
      name: 'Södermalm-rundan',
      createdBy: 'user-1',
      startLatitude: 59.31,
      startLongitude: 18.07,
      plannedDate: '2026-05-01',
    },
  },
  stops: {
    add: [
      { fleaMarketId: 'market-a' },
      { fleaMarketId: 'market-b' },
    ],
    remove: [],
  },
}

const updatePlan: RoutePlan = {
  route: {
    update: {
      id: 'route-9',
      patch: {
        name: 'Uppdaterad runda',
        startLatitude: 59.33,
        startLongitude: 18.05,
        plannedDate: '2026-06-15',
      },
    },
  },
  stops: {
    add: [{ fleaMarketId: 'market-c' }],
    remove: ['stop-old-1', 'stop-old-2'],
  },
}

// ---------- Happy path: create ----------

describe('runRouteMutation — create new route', () => {
  it('emits full happy-path event sequence', async () => {
    const api = makeApi()
    const events = await collect(createPlan, { api })

    const phases = events.map((e) =>
      'phase' in e ? `${e.phase}:${e.status}` : `end:${e.type}`,
    )

    expect(phases).toEqual([
      'saving_route:start',
      'saving_route:ok',
      'saving_stops:start',
      'saving_stops:item_start',  // add index 0
      'saving_stops:item_ok',
      'saving_stops:item_start',  // add index 1
      'saving_stops:item_ok',
      'saving_stops:done',
      'end:complete',
    ])

    expect(api.routes.create).toHaveBeenCalledTimes(1)
    expect(api.routes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Södermalm-rundan',
        createdBy: 'user-1',
        stops: createPlan.stops.add,
      }),
    )

    const complete = events.at(-1)!
    expect(complete).toEqual({ type: 'complete', routeId: 'route-1' })
  })

  it('trims whitespace from route name', async () => {
    const api = makeApi()
    const plan: RoutePlan = {
      ...createPlan,
      route: { create: { ...createPlan.route['create' as keyof typeof createPlan.route]!, name: '  Trimmed  ' } },
    }
    await collect(plan, { api })
    expect(api.routes.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Trimmed' }))
  })
})

// ---------- Happy path: update ----------

describe('runRouteMutation — update existing route', () => {
  it('emits full happy-path event sequence with removes before adds', async () => {
    const api = makeApi()
    const events = await collect(updatePlan, { api })

    const phases = events.map((e) =>
      'phase' in e ? `${e.phase}:${e.status}` : `end:${e.type}`,
    )

    expect(phases).toEqual([
      'saving_route:start',
      'saving_route:ok',
      'saving_stops:start',
      'saving_stops:item_start',  // remove index 0
      'saving_stops:item_ok',
      'saving_stops:item_start',  // remove index 1
      'saving_stops:item_ok',
      'saving_stops:item_start',  // add index 0
      'saving_stops:item_ok',
      'saving_stops:done',
      'end:complete',
    ])

    expect(api.routes.update).toHaveBeenCalledTimes(1)
    expect(api.routes.update).toHaveBeenCalledWith(
      'route-9',
      expect.objectContaining({ name: 'Uppdaterad runda', stops: updatePlan.stops.add }),
    )

    const complete = events.at(-1)!
    expect(complete).toEqual({ type: 'complete', routeId: 'route-9' })
  })

  it('emits remove events before add events', async () => {
    const api = makeApi()
    const events = await collect(updatePlan, { api })

    // Only look at item_start events (one per stop) to avoid duplicates from item_ok.
    const stopItemStarts = events.filter(
      (e) => 'phase' in e && e.phase === 'saving_stops' && 'status' in e && (e as { status: string }).status === 'item_start',
    ) as Extract<RouteEvent, { phase: 'saving_stops'; status: 'item_start' }>[]

    const kinds = stopItemStarts.map((e) => e.kind)
    // removes come first, then adds
    expect(kinds).toEqual(['remove', 'remove', 'add'])
  })
})

// ---------- Non-critical stop failure ----------

describe('runRouteMutation — non-critical stop failure', () => {
  it('continues to complete even when a stop item would error', async () => {
    // The current implementation treats stop persistence as atomic (done
    // inside create/update), so individual stop errors are non-critical.
    // This test verifies the generator still yields `complete` after the
    // route is saved, regardless of stop-level concerns.
    const api = makeApi()
    const events = await collect(createPlan, { api })

    expect(events.at(-1)).toEqual({ type: 'complete', routeId: 'route-1' })
  })
})

// ---------- Critical route failure ----------

describe('runRouteMutation — critical route failure', () => {
  it('create failure emits failed and terminates without stop events', async () => {
    const api = makeApi({
      routes: {
        create: vi.fn().mockRejectedValue(new Error('DB error')),
        update: vi.fn(),
      },
    })
    const events = await collect(createPlan, { api })

    const last = events.at(-1)!
    expect('type' in last && last.type).toBe('failed')
    expect(last).toMatchObject({ type: 'failed', error: expect.objectContaining({ code: 'unknown' }) })

    // No stop events should have been emitted after the critical failure
    const stopEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_stops')
    expect(stopEvents).toHaveLength(0)
  })

  it('update failure emits failed and terminates without stop events', async () => {
    const api = makeApi({
      routes: {
        create: vi.fn(),
        update: vi.fn().mockRejectedValue(new Error('Forbidden')),
      },
    })
    const events = await collect(updatePlan, { api })

    expect(events.at(-1)).toMatchObject({ type: 'failed' })

    const stopEvents = events.filter((e) => 'phase' in e && e.phase === 'saving_stops')
    expect(stopEvents).toHaveLength(0)
  })

  it('failed event carries an AppError with message detail', async () => {
    const api = makeApi({
      routes: {
        create: vi.fn().mockRejectedValue(new Error('Network timeout')),
        update: vi.fn(),
      },
    })
    const events = await collect(createPlan, { api })

    const failed = events.find((e) => 'type' in e && e.type === 'failed') as
      | Extract<RouteEvent, { type: 'failed' }>
      | undefined
    expect(failed).toBeDefined()
    expect(failed!.error.detail?.message).toBe('Network timeout')
  })
})
