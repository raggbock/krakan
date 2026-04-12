import { createApi, createGeo, createSupabaseAuth } from '@fyndstigen/shared'
import { supabase } from './supabase'

export const api = createApi(supabase)
export const geo = createGeo(supabase)
export const auth = createSupabaseAuth(supabase)

// Re-export types for convenience
export type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  FleaMarketImage,
  OpeningHoursItem,
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
