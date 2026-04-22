// ============================================================
// DB Row types — shapes returned by Supabase (snake_case)
//
// These mirror the actual database columns. Keep in sync with
// supabase/migrations. Do NOT import these in UI components —
// use the domain types from domain.ts instead.
// ============================================================

import type { RuleType } from './shared-enums'
export type { BookingStatus, PaymentStatus, RuleType } from './shared-enums'

// --- Flea Markets ---

export type FleaMarketRow = {
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
  auto_accept_bookings: boolean
  created_at: string
  /** Set by listByOrganizer — true if the market appears in public listings. */
  isVisible?: boolean
}

// --- Opening Hours ---

export type OpeningHourRuleRow = {
  id: string
  type: RuleType
  day_of_week: number | null
  anchor_date: string | null
  open_time: string
  close_time: string
}

export type OpeningHourExceptionRow = {
  id: string
  date: string
  reason: string | null
}

// --- Images ---

export type FleaMarketImageRow = {
  id: string
  storage_path: string
  sort_order: number
}

// --- Profiles ---

export type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  phone_number: string | null
  user_type: number
}

export type OrganizerProfileRow = ProfileRow & {
  bio: string | null
  website: string | null
  logo_path: string | null
  subscription_tier: number
}

// --- Market Tables ---

export type MarketTableRow = {
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

export type BookingRow = {
  id: string
  market_table_id: string
  flea_market_id: string
  booked_by: string
  booking_date: string
  status: import('./shared-enums').BookingStatus
  price_sek: number
  commission_sek: number
  commission_rate: number
  message: string | null
  organizer_note: string | null
  stripe_payment_intent_id: string | null
  payment_status: import('./shared-enums').PaymentStatus | null
  expires_at: string | null
  created_at: string
}

// --- Routes ---

export type RouteRow = {
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

export type RouteStopRow = {
  id: string
  route_id: string
  flea_market_id: string
  sort_order: number
}

// --- Stripe ---

export type StripeAccountRow = {
  id: string
  organizer_id: string
  stripe_account_id: string
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}
