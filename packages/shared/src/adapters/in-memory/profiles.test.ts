import { describe, it, expect } from 'vitest'
import { createInMemoryProfiles, createInMemoryOrganizers } from './profiles'
import type { UserProfileView, OrganizerProfileView } from '../../types'

function makeProfile(overrides: Partial<UserProfileView> = {}): UserProfileView {
  return {
    id: 'user-1',
    firstName: 'Anna',
    lastName: 'Andersson',
    phoneNumber: null,
    userType: 0,
    ...overrides,
  }
}

function makeOrganizerProfile(overrides: Partial<OrganizerProfileView> = {}): OrganizerProfileView {
  return {
    id: 'org-1',
    firstName: 'Bo',
    lastName: 'Bergström',
    phoneNumber: null,
    userType: 1,
    bio: null,
    website: null,
    logoPath: null,
    subscriptionTier: 0,
    ...overrides,
  }
}

describe('createInMemoryProfiles', () => {
  it('get returns seeded profile', async () => {
    const repo = createInMemoryProfiles([makeProfile()])
    const p = await repo.get('user-1')
    expect(p.firstName).toBe('Anna')
  })

  it('update modifies the profile', async () => {
    const repo = createInMemoryProfiles([makeProfile()])
    await repo.update('user-1', { firstName: 'Britta' })
    const p = await repo.get('user-1')
    expect(p.firstName).toBe('Britta')
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
    expect(o.firstName).toBe('Bo')
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
