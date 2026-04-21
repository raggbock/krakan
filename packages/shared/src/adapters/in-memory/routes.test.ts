import { describe, it, expect } from 'vitest'
import { createInMemoryRoutes } from './routes'

const basePayload = {
  name: 'Testrundan',
  createdBy: 'user-1',
  stops: [{ fleaMarketId: 'fm-1' }, { fleaMarketId: 'fm-2' }],
}

describe('createInMemoryRoutes', () => {
  it('create-then-get returns what was stored', async () => {
    const repo = createInMemoryRoutes()
    const { id } = await repo.create(basePayload)
    const route = await repo.get(id)
    expect(route.name).toBe('Testrundan')
    expect(route.stops).toHaveLength(2)
    expect(route.is_published).toBe(false)
  })

  it('listByUser returns only that user\'s non-deleted routes', async () => {
    const repo = createInMemoryRoutes()
    const { id: id1 } = await repo.create(basePayload)
    await repo.create({ ...basePayload, createdBy: 'user-2' })
    const { id: id3 } = await repo.create(basePayload)
    await repo.delete(id3)
    const result = await repo.listByUser('user-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(id1)
  })

  it('publish/unpublish toggles is_published', async () => {
    const repo = createInMemoryRoutes()
    const { id } = await repo.create(basePayload)
    expect((await repo.get(id)).is_published).toBe(false)

    await repo.publish(id)
    expect((await repo.get(id)).is_published).toBe(true)
    expect((await repo.get(id)).published_at).not.toBeNull()

    await repo.unpublish(id)
    expect((await repo.get(id)).is_published).toBe(false)
    expect((await repo.get(id)).published_at).toBeNull()
  })

  it('soft-delete excludes route from listByUser', async () => {
    const repo = createInMemoryRoutes()
    const { id } = await repo.create(basePayload)
    const before = await repo.listByUser('user-1')
    expect(before).toHaveLength(1)

    await repo.delete(id)
    const after = await repo.listByUser('user-1')
    expect(after).toHaveLength(0)
  })

  it('update replaces stops', async () => {
    const repo = createInMemoryRoutes()
    const { id } = await repo.create(basePayload)
    await repo.update(id, {
      name: 'Uppdaterad rundan',
      stops: [{ fleaMarketId: 'fm-3' }],
    })
    const route = await repo.get(id)
    expect(route.name).toBe('Uppdaterad rundan')
    expect(route.stops).toHaveLength(1)
  })
})
