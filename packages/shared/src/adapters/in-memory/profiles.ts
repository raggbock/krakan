/**
 * In-memory adapters for ProfileRepository and OrganizerRepository — test doubles.
 *
 * Non-atomic: synchronous Map mutations. Throws on missing IDs (programmer
 * error in test setup, not a user-facing condition).
 * `OrganizerRepository.stats()` returns empty stats — override in tests
 * that need specific organizer stat values.
 */

import type { UserProfileView, OrganizerProfileView, OrganizerStats } from '../../types'
import type { ProfileRepository, OrganizerRepository } from '../../ports/profiles'

export function createInMemoryProfiles(seed: UserProfileView[] = []): ProfileRepository {
  const store = new Map<string, UserProfileView>(seed.map((p) => [p.id, { ...p }]))

  return {
    async get(userId: string): Promise<UserProfileView> {
      const p = store.get(userId)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!p) throw new Error(`Profile ${userId} not found`)
      return { ...p }
    },

    async update(userId: string, updates: Partial<UserProfileView>): Promise<void> {
      const existing = store.get(userId)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Profile ${userId} not found`)
      store.set(userId, { ...existing, ...updates })
    },
  }
}

export function createInMemoryOrganizers(seed: OrganizerProfileView[] = []): OrganizerRepository {
  const profileStore = new Map<string, OrganizerProfileView>(seed.map((p) => [p.id, { ...p }]))
  const statsStore = new Map<string, OrganizerStats>()

  return {
    async get(userId: string): Promise<OrganizerProfileView> {
      const p = profileStore.get(userId)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!p) throw new Error(`OrganizerProfile ${userId} not found`)
      return { ...p }
    },

    async update(userId, updates) {
      const existing = profileStore.get(userId)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
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
