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
