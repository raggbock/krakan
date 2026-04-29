import {
  createGeo,
  createSupabaseAuth,
  createBookingService,
  createSupabaseBookings,
} from '@fyndstigen/shared'
import { supabase } from './supabase'
import { endpoints, edge } from './edge'

// Re-export edge layer so any legacy test that mocks '@/lib/api' for
// `api.endpoints` / `api.edge` keeps working without changes.
// New code should import directly from '@/lib/edge'.
export { endpoints, edge }

export const geo = createGeo(supabase)
export const auth = createSupabaseAuth(supabase)

/**
 * Booking service facade — single entry point for all booking operations.
 * Kept until PR 10 migrates use-booking.ts off bookingService.
 * Uses a minimal private api object (bookings + endpoints) rather than the
 * full legacy createApi surface — which has been removed in PR 9.
 */
const _bookingApi = {
  bookings: createSupabaseBookings(supabase),
  endpoints,
} as const
export const bookingService = createBookingService({ api: _bookingApi as never })

// Re-export types for convenience
export type {
  BookingService,
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  FleaMarketImage,
  UserProfile,
  OrganizerProfile,
  OrganizerStats,
  MarketTable,
  Booking,
  BookingWithDetails,
  BookingView,
  Route,
  RouteStop,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
  SearchResult,
  CreateFleaMarketPayload,
  UpdateFleaMarketPayload,
  CreateRoutePayload,
  UpdateRoutePayload,
  CreateBookingPayload,
  CreateMarketTablePayload,
  AddressPayload,
  StripeAccount,
  PaymentStatus,
} from '@fyndstigen/shared'
