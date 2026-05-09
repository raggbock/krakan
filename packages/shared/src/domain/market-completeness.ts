/**
 * MarketCompleteness — scoring function for admin market curation.
 *
 * `marketCompleteness(row)` inspects an AdminMarketRow and returns:
 *   - `isComplete`       — all tracked fields are present
 *   - `isAlmostComplete` — at most one field missing (highlight in admin UI)
 *   - `missingFields`    — typed list of gap categories (address, lat_lng, etc.)
 *
 * Tracked fields: address (street + zip + city), coordinates, opening hours,
 * and organizer contact info (website + phone + email).
 *
 * Pure function — no I/O, no side effects.
 */

import type { AdminMarketRow } from '../contracts/admin-markets-overview'

export type MissingField =
  | 'description' | 'images' | 'opening_hours' | 'tables' | 'address' | 'lat_lng' | 'organizer'

export type MarketCompleteness = {
  isComplete: boolean
  isAlmostComplete: boolean
  missingFields: MissingField[]
}

export function marketCompleteness(row: AdminMarketRow): MarketCompleteness {
  const missing: MissingField[] = []

  if (!row.street || !row.zipCode || !row.city) {
    missing.push('address')
  }

  if (!row.hasCoordinates) {
    missing.push('lat_lng')
  }

  if (!row.hasOpeningHours) {
    missing.push('opening_hours')
  }

  if (!row.hasWebsite || !row.hasPhone || !row.hasEmail) {
    missing.push('organizer')
  }

  const isComplete = missing.length === 0
  const isAlmostComplete = missing.length <= 1

  return { isComplete, isAlmostComplete, missingFields: missing }
}
