// ============================================================
// Types public surface
//
// TODO(follow-up): Migrate the ~25 remaining consumers of the
// snake_case aliases below to the camelCase View types. Track
// in issue #9. Start with the hooks in web/src/hooks/ — they
// are the next highest DB-leak surface after the booking page.
// ============================================================

// --- Domain types (preferred public surface) ---
export type {
  BookingStatus,
  PaymentStatus,
  RuleType,
} from './shared-enums'

export type {
  Coord,
  FleaMarketView,
  FleaMarketDetailsView,
  FleaMarketNearByView,
  OpeningHourRuleView,
  OpeningHourExceptionView,
  FleaMarketImageView,
  UserProfileView,
  OrganizerProfileView,
  MarketTableView,
  BookingView,
  RouteView,
  RouteStopView,
  RouteSummaryView,
  PopularRouteView,
  BlockSale,
  BlockSaleStand,
  BlockSaleStandStatus,
} from './domain'

// --- DB row types (for mappers and api layer only) ---
export type {
  FleaMarketRow,
  OpeningHourRuleRow,
  OpeningHourExceptionRow,
  FleaMarketImageRow,
  ProfileRow,
  OrganizerProfileRow,
  MarketTableRow,
  BookingRow as BookingDbRow,
  RouteRow,
  RouteStopRow,
  StripeAccountRow,
} from './db'

// ============================================================
// Back-compat aliases — keep existing snake_case imports working
// so callers outside mappers.ts need zero changes in this PR.
//
// DO NOT add new consumers of these aliases. Prefer the *View
// types above. Remove aliases one domain at a time in follow-ups.
// ============================================================

import type {
  FleaMarketRow,
  OpeningHourRuleRow,
  OpeningHourExceptionRow,
  FleaMarketImageRow,
  ProfileRow,
  OrganizerProfileRow,
  MarketTableRow,
  BookingRow as BookingDbRow,
  RouteRow,
} from './db'
import type {
  BookingStatus,
  PaymentStatus,
  RuleType,
} from './shared-enums'

// FleaMarket
export type FleaMarket = FleaMarketRow
export type FleaMarketDetails = FleaMarketRow & {
  organizerName: string
  opening_hour_rules: OpeningHourRuleRow[]
  opening_hour_exceptions: OpeningHourExceptionRow[]
  flea_market_images: FleaMarketImageRow[]
}

// Images
export type FleaMarketImage = FleaMarketImageRow

// Profiles
export type UserProfile = ProfileRow
export type OrganizerProfile = OrganizerProfileRow
export type OrganizerStats = {
  organizer_id: string
  market_count: number
  total_bookings: number
  total_revenue_sek: number
  total_commission_sek: number
}

// Market tables
export type MarketTable = MarketTableRow

// Bookings
export type Booking = BookingDbRow

// Routes
export type Route = RouteRow
export type RouteStop = {
  id: string
  sortOrder: number
  fleaMarket: (FleaMarketRow & {
    opening_hour_rules: OpeningHourRuleRow[]
    opening_hour_exceptions: OpeningHourExceptionRow[]
  }) | null
}
export type RouteWithStops = RouteRow & {
  creatorName: string
  stops: RouteStop[]
}
export type RouteSummary = RouteRow & {
  stopCount: number
}
// Payloads (these were already camelCase — no aliases needed)
export type AddressPayload = {
  street: string
  city: string
  zipCode: string
  country: string
  location: { latitude: number; longitude: number }
}

export type CreateFleaMarketPayload = {
  name: string
  description: string
  address: AddressPayload
  isPermanent: boolean
  organizerId: string
  autoAcceptBookings?: boolean
  openingHours: {
    type: RuleType
    dayOfWeek: number | null
    anchorDate: string | null
    openTime: string
    closeTime: string
  }[]
  openingHourExceptions?: {
    date: string
    reason: string | null
  }[]
}

export type UpdateFleaMarketPayload = Omit<CreateFleaMarketPayload, 'organizerId'>

export type CreateRoutePayload = {
  name: string
  description?: string
  createdBy: string
  startLatitude?: number
  startLongitude?: number
  plannedDate?: string
  stops: { fleaMarketId: string }[]
}

export type UpdateRoutePayload = Omit<CreateRoutePayload, 'createdBy'>

export type CreateBookingPayload = {
  marketTableId: string
  fleaMarketId: string
  bookedBy: string
  bookingDate: string
  priceSek: number
  message?: string
}

export type CreateMarketTablePayload = {
  fleaMarketId: string
  label: string
  description?: string
  priceSek: number
  sizeDescription?: string
}

export type SearchResult = {
  fleaMarkets: FleaMarket[]
}
