import { describe, it, expect } from 'vitest'
import { createSupabaseStripeAccountRepo } from './stripe-account-repo'

function makeFakeClient(opts: {
  error?: unknown
}) {
  const calls: Array<{ table: string; update: unknown; eq: { field: string; value: unknown } }> = []

  function makeBuilder(table: string) {
    let updateData: unknown = null
    let eqField = ''
    let eqValue: unknown = null

    const builder = {
      update(data: unknown) {
        updateData = data
        return builder
      },
      eq(field: string, value: unknown) {
        eqField = field
        eqValue = value
        calls.push({ table, update: updateData, eq: { field: eqField, value: eqValue } })
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

describe('SupabaseStripeAccountRepo.setOnboardingComplete', () => {
  it('updates stripe_accounts with onboarding_complete=true', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseStripeAccountRepo(client as never)
    await repo.setOnboardingComplete('acct_123', true)
    expect(client._calls).toHaveLength(1)
    expect(client._calls[0].table).toBe('stripe_accounts')
    expect(client._calls[0].update).toEqual({ onboarding_complete: true })
    expect(client._calls[0].eq).toEqual({ field: 'stripe_account_id', value: 'acct_123' })
  })

  it('updates with onboarding_complete=false', async () => {
    const client = makeFakeClient({})
    const repo = createSupabaseStripeAccountRepo(client as never)
    await repo.setOnboardingComplete('acct_456', false)
    expect(client._calls[0].update).toEqual({ onboarding_complete: false })
  })

  it('throws when DB returns an error', async () => {
    const client = makeFakeClient({ error: { message: 'db error' } })
    const repo = createSupabaseStripeAccountRepo(client as never)
    await expect(repo.setOnboardingComplete('acct_123', true)).rejects.toThrow(/Failed to update stripe account/)
  })
})
