/**
 * Profile ports — user profile and organizer profile repositories.
 *
 *   - ProfileRepository  — read/update the basic user profile (display name, avatar, etc.).
 *   - OrganizerRepository — read/update the richer organizer profile; includes `stats()`
 *       which returns summary counts (markets, bookings) for the organizer dashboard.
 *
 * Implementations: adapters/supabase/profiles.ts, adapters/in-memory/profiles.ts.
 */

import type { UserProfileView, OrganizerProfileView, OrganizerStats } from '../types'

export interface ProfileRepository {
  get(userId: string): Promise<UserProfileView>
  update(userId: string, updates: Partial<UserProfileView>): Promise<void>
}

export interface OrganizerRepository {
  get(userId: string): Promise<OrganizerProfileView>
  update(
    userId: string,
    updates: Partial<Pick<OrganizerProfileView, 'bio' | 'website' | 'firstName' | 'lastName' | 'phoneNumber'>>,
  ): Promise<void>
  stats(userId: string): Promise<OrganizerStats>
}
