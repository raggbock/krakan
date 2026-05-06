import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryStripeAccountRepo, type InMemoryStripeAccountRepo } from './stripe-account-repo'

let repo: InMemoryStripeAccountRepo

beforeEach(() => {
  repo = createInMemoryStripeAccountRepo()
})

describe('setOnboardingComplete', () => {
  it('stores the complete flag as true', async () => {
    await repo.setOnboardingComplete('acct_1', true)
    expect(repo._getState('acct_1')).toEqual({ complete: true })
  })

  it('stores the complete flag as false', async () => {
    await repo.setOnboardingComplete('acct_1', false)
    expect(repo._getState('acct_1')).toEqual({ complete: false })
  })

  it('overwrites an existing state', async () => {
    await repo.setOnboardingComplete('acct_1', false)
    await repo.setOnboardingComplete('acct_1', true)
    expect(repo._getState('acct_1')?.complete).toBe(true)
  })

  it('returns undefined for unknown account', () => {
    expect(repo._getState('acct_unknown')).toBeUndefined()
  })
})
