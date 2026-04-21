import { createApi, createGeo, createSupabaseAuth, createBookingService } from '@fyndstigen/shared'
import { supabase } from './supabase'
import { compressImage } from './compress-image'

export const api = createApi(supabase, { compressImage })
export const geo = createGeo(supabase)
export const auth = createSupabaseAuth(supabase)

/**
 * Booking service facade — single entry point for all booking operations.
 * Prefer this over importing calculateCommission / api.endpoints.bookingCreate directly.
 */
export const bookingService = createBookingService({ api })

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
