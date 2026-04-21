import { describe, it, expect } from 'vitest'
import { createInMemoryProfiles, createInMemoryOrganizers } from './profiles'
import type { UserProfile, OrganizerProfile } from '../../types'

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    first_name: 'Anna',
    last_name: 'Andersson',
    phone_number: null,
    user_type: 0,
    ...overrides,
  } as UserProfile
}

function makeOrganizerProfile(overrides: Partial<OrganizerProfile> = {}): OrganizerProfile {
  return {
    id: 'org-1',
    first_name: 'Bo',
    last_name: 'Bergström',
    phone_number: null,
    user_type: 1,
    bio: null,
    website: null,
    logo_path: null,
    subscription_tier: 0,
    ...overrides,
  } as OrganizerProfile
}

describe('createInMemoryProfiles', () => {
  it('get returns seeded profile', async () => {
    const repo = createInMemoryProfiles([makeProfile()])
    const p = await repo.get('user-1')
    expect(p.first_name).toBe('Anna')
  })

  it('update modifies the profile', async () => {
    const repo = createInMemoryProfiles([makeProfile()])
    await repo.update('user-1', { first_name: 'Britta' })
    const p = await repo.get('user-1')
    expect(p.first_name).toBe('Britta')
  })

  it('get throws for unknown user', async () => {
    const repo = createInMemoryProfiles()
    await expect(repo.get('no-one')).rejects.toThrow()
  })
})

describe('createInMemoryOrganizers', () => {
  it('get returns seeded organizer', async () => {
    const repo = createInMemoryOrganizers([makeOrganizerProfile()])
    const o = await repo.get('org-1')
    expect(o.first_name).toBe('Bo')
  })

  it('stats returns zeros for unknown organizer', async () => {
    const repo = createInMemoryOrganizers()
    const s = await repo.stats('org-unknown')
    expect(s.market_count).toBe(0)
    expect(s.total_bookings).toBe(0)
  })

  it('update modifies organizer fields', async () => {
    const repo = createInMemoryOrganizers([makeOrganizerProfile()])
    await repo.update('org-1', { bio: 'Jag säljer allt!' })
    const o = await repo.get('org-1')
    expect(o.bio).toBe('Jag säljer allt!')
  })
})
