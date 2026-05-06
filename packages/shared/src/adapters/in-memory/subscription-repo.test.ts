import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemorySubscriptionRepo, type InMemorySubscriptionRepo } from './subscription-repo'

let repo: InMemorySubscriptionRepo

beforeEach(() => {
  repo = createInMemorySubscriptionRepo()
})

describe('setTierByUserId', () => {
  it('stores tier 1 for a user', async () => {
    await repo.setTierByUserId('user-1', 1)
    expect(repo._getTierByUserId('user-1')).toBe(1)
  })

  it('stores tier 0 for a user', async () => {
    await repo.setTierByUserId('user-1', 0)
    expect(repo._getTierByUserId('user-1')).toBe(0)
  })

  it('overwrites an existing tier', async () => {
    await repo.setTierByUserId('user-1', 1)
    await repo.setTierByUserId('user-1', 0)
    expect(repo._getTierByUserId('user-1')).toBe(0)
  })

  it('returns undefined for unknown user', () => {
    expect(repo._getTierByUserId('unknown')).toBeUndefined()
  })
})

describe('setTierByCustomerId', () => {
  it('stores tier 1 for a customer', async () => {
    await repo.setTierByCustomerId('cus_1', 1)
    expect(repo._getTierByCustomerId('cus_1')).toBe(1)
  })

  it('stores tier 0 for a customer', async () => {
    await repo.setTierByCustomerId('cus_1', 0)
    expect(repo._getTierByCustomerId('cus_1')).toBe(0)
  })

  it('does not mix user and customer stores', async () => {
    await repo.setTierByUserId('user-1', 1)
    expect(repo._getTierByCustomerId('user-1')).toBeUndefined()
  })
})
