// ============================================
// Domain types — shared between web and mobile
// ============================================

// --- Flea Markets ---

export type FleaMarket = {
  id: string
  name: string
  description: string
  street: string
  zip_code: string
  city: string
  country: string
  is_permanent: boolean
  latitude: number
  longitude: number
  published_at: string | null
  organizer_id: string
  created_at: string
}

export type FleaMarketDetails = FleaMarket & {
  organizerName: string
  opening_hour_rules: OpeningHourRule[]
  opening_hour_exceptions: OpeningHourException[]
  flea_market_images: FleaMarketImage[]
}

export type FleaMarketNearBy = {
  id: string
  name: string
  description: string
  city: string
  is_permanent: boolean
  latitude: number
  longitude: number
  distance_km: number
  published_at: string | null
}

// --- Opening Hours ---

export type RuleType = 'weekly' | 'biweekly' | 'date'

export type OpeningHourRule = {
  id: string
  type: RuleType
  day_of_week: number | null
  anchor_date: string | null
  open_time: string
  close_time: string
}

export type OpeningHourException = {
  id: string
  date: string
  reason: string | null
}

// --- Images ---

export type FleaMarketImage = {
  id: string
  storage_path: string
  sort_order: number
}

// --- Profiles ---

export type UserProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  user_type: number
}

export type OrganizerProfile = UserProfile & {
  bio: string | null
  website: string | null
  logo_path: string | null
  subscription_tier: number
}

export type OrganizerStats = {
  organizer_id: string
  market_count: number
  total_bookings: number
  total_revenue_sek: number
  total_commission_sek: number
}

// --- Stripe ---

export type PaymentStatus = 'requires_capture' | 'captured' | 'cancelled' | 'failed'

export type StripeAccount = {
  id: string
  organizer_id: string
  stripe_account_id: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

// --- Market Tables ---

export type MarketTable = {
  id: string
  flea_market_id: string
  label: string
  description: string | null
  price_sek: number
  size_description: string | null
  is_available: boolean
  max_per_day: number
  sort_order: number
}

// --- Bookings ---

export type BookingStatus = 'pending' | 'confirmed' | 'denied' | 'cancelled'

export type Booking = {
  id: string
  market_table_id: string
  flea_market_id: string
  booked_by: string
  booking_date: string
  status: BookingStatus
  price_sek: number
  commission_sek: number
  commission_rate: number
  message: string | null
  organizer_note: string | null
  stripe_payment_intent_id: string | null
  payment_status: PaymentStatus | null
  expires_at: string | null
  created_at: string
}

export type BookingWithDetails = Booking & {
  market_table: MarketTable | null
  flea_market: { name: string; city: string } | null
  booker: { first_name: string | null; last_name: string | null } | null
}

// --- Routes ---

export type Route = {
  id: string
  name: string
  description: string | null
  created_by: string
  start_latitude: number | null
  start_longitude: number | null
  planned_date: string | null
  is_published: boolean
  published_at: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}

export type RouteStop = {
  id: string
  sortOrder: number
  fleaMarket: (FleaMarket & { opening_hour_rules: OpeningHourRule[]; opening_hour_exceptions: OpeningHourException[] }) | null
}

export type RouteWithStops = Route & {
  creatorName: string
  stops: RouteStop[]
}

export type RouteSummary = Route & {
  stopCount: number
}

export type PopularRoute = {
  id: string
  name: string
  description: string | null
  created_by: string
  planned_date: string | null
  published_at: string | null
  stop_count: number
  creator_first_name: string | null
  creator_last_name: string | null
}

// --- Payloads ---

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
