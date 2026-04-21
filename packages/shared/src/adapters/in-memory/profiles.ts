import type { UserProfile, OrganizerProfile, OrganizerStats } from '../../types'
import type { ProfileRepository, OrganizerRepository } from '../../ports/profiles'

export function createInMemoryProfiles(seed: UserProfile[] = []): ProfileRepository {
  const store = new Map<string, UserProfile>(seed.map((p) => [p.id, { ...p }]))

  return {
    async get(userId: string): Promise<UserProfile> {
      const p = store.get(userId)
      if (!p) throw new Error(`Profile ${userId} not found`)
      return { ...p }
    },

    async update(userId: string, updates: Partial<UserProfile>): Promise<void> {
      const existing = store.get(userId)
      if (!existing) throw new Error(`Profile ${userId} not found`)
      store.set(userId, { ...existing, ...updates })
    },
  }
}

export function createInMemoryOrganizers(seed: OrganizerProfile[] = []): OrganizerRepository {
  const profileStore = new Map<string, OrganizerProfile>(seed.map((p) => [p.id, { ...p }]))
  const statsStore = new Map<string, OrganizerStats>()

  return {
    async get(userId: string): Promise<OrganizerProfile> {
      const p = profileStore.get(userId)
      if (!p) throw new Error(`OrganizerProfile ${userId} not found`)
      return { ...p }
    },

    async update(userId, updates) {
      const existing = profileStore.get(userId)
      if (!existing) throw new Error(`OrganizerProfile ${userId} not found`)
      profileStore.set(userId, { ...existing, ...updates })
    },

    async stats(userId: string): Promise<OrganizerStats> {
      return (
        statsStore.get(userId) ?? {
          organizer_id: userId,
          market_count: 0,
          total_bookings: 0,
          total_revenue_sek: 0,
          total_commission_sek: 0,
        }
      )
    },
  }
}
