import { describe, it, expect } from 'vitest'
import { createSupabaseSubscriptionRepo } from './subscription-repo'

function makeFakeClient(opts: {
  error?: unknown
}) {
  const calls: Array<{ table: string; update: unknown; eq: { field: string; value: unknown } }> = []

  function makeBuilder(table: string) {
    let updateData: unknown = null

    const builder = {
      update(data: unknown) {
        updateData = data
        return builder
      },
      eq(field: string, value: unknown) {
        calls.push({ table, update: updateData, eq: { field, value } })
        return Promise.resolve({ data: null, error: opts.error ?? null })
      },
    }
    return builder
  }

  const client = {
    from: (table: string) => makeBuilder(table),
    _calls: calls,
  }
  return client
}

describe('SupabaseSubscriptionRepo.setTierByUserId', () => {
  it('updates profiles with subscription_tier=1 by user id', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseSubscriptionRepo(client as never)
    await repo.setTierByUserId('user-1', 1)
    expect(client._calls).toHaveLength(1)
    expect(client._calls[0].table).toBe('profiles')
    expect(client._calls[0].update).toEqual({ subscription_tier: 1 })
    expect(client._calls[0].eq).toEqual({ field: 'id', value: 'user-1' })
  })

  it('updates profiles with subscription_tier=0 by user id', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseSubscriptionRepo(client as never)
    await repo.setTierByUserId('user-2', 0)
    expect(client._calls[0].update).toEqual({ subscription_tier: 0 })
  })

  it('throws when DB returns an error', async () => {
    const client = makeFakeClient({ error: { message: 'db error' } })
    const repo = createSupabaseSubscriptionRepo(client as never)
    await expect(repo.setTierByUserId('user-1', 1)).rejects.toThrow(/Failed to set tier for user/)
  })
})

describe('SupabaseSubscriptionRepo.setTierByCustomerId', () => {
  it('updates profiles with subscription_tier=1 by customer id', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseSubscriptionRepo(client as never)
    await repo.setTierByCustomerId('cus_1', 1)
    expect(client._calls).toHaveLength(1)
    expect(client._calls[0].table).toBe('profiles')
    expect(client._calls[0].update).toEqual({ subscription_tier: 1 })
    expect(client._calls[0].eq).toEqual({ field: 'stripe_customer_id', value: 'cus_1' })
  })

  it('updates profiles with subscription_tier=0 by customer id', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseSubscriptionRepo(client as never)
    await repo.setTierByCustomerId('cus_2', 0)
    expect(client._calls[0].update).toEqual({ subscription_tier: 0 })
  })

  it('throws when DB returns an error', async () => {
    const client = makeFakeClient({ error: { message: 'db error' } })
    const repo = createSupabaseSubscriptionRepo(client as never)
    await expect(repo.setTierByCustomerId('cus_1', 1)).rejects.toThrow(/Failed to set tier for customer/)
  })
})
