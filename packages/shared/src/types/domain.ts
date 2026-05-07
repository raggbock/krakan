// ============================================================
// Domain view types — camelCase shapes for UI/hook consumption
//
// These are the types components and hooks should import.
// They are produced by mappers in api/mappers.ts and contain
// no raw FK columns or DB implementation details.
// ============================================================

import type { BookingStatus, PaymentStatus, RuleType } from './shared-enums'

export type { BookingStatus, PaymentStatus, RuleType }

// --- Geometry ---

/**
 * Canonical coordinate type. All callers should use this rather than ad-hoc
 * `{ lat: number; lng: number }` definitions. The previous file-local aliases
 * `Coordinate`, `Point`, and `LatLng` have been unified into this single type
 * (see issue #85).
 */
export type Coord = { lat: number; lng: number }

// --- Flea Markets ---

export type FleaMarketView = {
  id: string
  name: string
  description: string
  street: string
  zipCode: string
  city: string
  country: string
  isPermanent: boolean
  latitude: number
  longitude: number
  publishedAt: string | null
  organizerId: string
  autoAcceptBookings: boolean
  createdAt: string
}

export type FleaMarketDetailsView = FleaMarketView & {
  organizerName: string
  openingHourRules: OpeningHourRuleView[]
  openingHourExceptions: OpeningHourExceptionView[]
  images: FleaMarketImageView[]
}

export type FleaMarketNearByView = {
  id: string
  name: string
  description: string
  city: string
  isPermanent: boolean
  latitude: number
  longitude: number
  distanceKm: number
  publishedAt: string | null
}

// --- Opening Hours ---

export type OpeningHourRuleView = {
  id: string
  type: RuleType
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

export type OpeningHourExceptionView = {
  id: string
  date: string
  reason: string | null
}

// --- Images ---

export type FleaMarketImageView = {
  id: string
  storagePath: string
  sortOrder: number
}

// --- Profiles ---

export type UserProfileView = {
  id: string
  firstName: string | null
  lastName: string | null
  phoneNumber: string | null
  userType: number
}

export type OrganizerProfileView = UserProfileView & {
  bio: string | null
  website: string | null
  logoPath: string | null
  subscriptionTier: number
}

// --- Market Tables ---

export type MarketTableView = {
  id: string
  fleaMarketId: string
  label: string
  description: string | null
  priceSek: number
  sizeDescription: string | null
  isAvailable: boolean
  maxPerDay: number
  sortOrder: number
}

// --- Bookings ---

/**
 * BookingView — the clean domain type for booking data.
 *
 * All snake_case FK columns are replaced by typed sub-objects.
 * Components should import this type; never touch BookingRow directly.
 */
export type BookingView = {
  id: string
  /** The booked table — null if the join was not requested */
  table: { id: string; label: string; description: string | null; sizeDescription: string | null } | null
  /** The market — null if the join was not requested */
  market: { id: string; name: string; city: string } | null
  /** The person who made the booking — null if join not requested */
  booker: { id: string; firstName: string | null; lastName: string | null } | null
  date: string
  status: BookingStatus
  price: {
    baseSek: number
    commissionSek: number
    commissionRate: number
  }
  message: string | null
  organizerNote: string | null
  payment: {
    status: PaymentStatus | null
    intentId: string | null
    expiresAt: string | null
  }
  createdAt: string
}

// --- Routes ---

export type RouteView = {
  id: string
  name: string
  description: string | null
  createdBy: string
  creatorName: string
  startLatitude: number | null
  startLongitude: number | null
  plannedDate: string | null
  isPublished: boolean
  publishedAt: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  stops: RouteStopView[]
}

export type RouteStopView = {
  id: string
  sortOrder: number
  fleaMarket: (FleaMarketView & {
    openingHourRules: OpeningHourRuleView[]
    openingHourExceptions: OpeningHourExceptionView[]
  }) | null
}

export type RouteSummaryView = {
  id: string
  name: string
  description: string | null
  createdBy: string
  startLatitude: number | null
  startLongitude: number | null
  plannedDate: string | null
  isPublished: boolean
  publishedAt: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  stopCount: number
}

export type PopularRouteView = {
  id: string
  name: string
  description: string | null
  createdBy: string
  plannedDate: string | null
  publishedAt: string | null
  stopCount: number
  creatorFirstName: string | null
  creatorLastName: string | null
}

// --- Block Sales (Kvartersloppis) ---

export type BlockSale = {
  id: string
  organizerId: string
  name: string
  slug: string
  description: string | null
  startDate: string  // ISO date
  endDate: string
  dailyOpen: string  // HH:MM
  dailyClose: string
  city: string
  region: string | null
  centerLocation: { latitude: number; longitude: number } | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type BlockSaleStandStatus = 'pending' | 'confirmed' | 'approved' | 'rejected'

export type BlockSaleStand = {
  id: string
  blockSaleId: string
  userId: string | null
  applicantEmail: string
  applicantName: string
  street: string
  zipCode: string | null
  city: string
  location: { latitude: number; longitude: number } | null
  description: string
  status: BlockSaleStandStatus
  emailConfirmedAt: string | null
  decidedAt: string | null
  createdAt: string
}
