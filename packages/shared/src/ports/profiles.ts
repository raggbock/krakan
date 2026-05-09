/**
 * Profile ports — user profile and organizer profile repositories.
 *
 *   - ProfileRepository  — read/update the basic user profile (display name, avatar, etc.).
 *   - OrganizerRepository — read/update the richer organizer profile; includes `stats()`
 *       which returns summary counts (markets, bookings) for the organizer dashboard.
 *
 * Implementations: adapters/supabase/profiles.ts, adapters/in-memory/profiles.ts.
 */

import type { UserProfile, OrganizerProfile, OrganizerStats } from '../types'

export interface ProfileRepository {
  get(userId: string): Promise<UserProfile>
  update(userId: string, updates: Partial<UserProfile>): Promise<void>
}

export interface OrganizerRepository {
  get(userId: string): Promise<OrganizerProfile>
  update(
    userId: string,
    updates: Partial<Pick<OrganizerProfile, 'bio' | 'website' | 'first_name' | 'last_name' | 'phone_number'>>,
  ): Promise<void>
  stats(userId: string): Promise<OrganizerStats>
}
