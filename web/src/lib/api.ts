import { createApi, createGeo, createSupabaseAuth } from '@fyndstigen/shared'
import { supabase } from './supabase'
import { compressImage } from './compress-image'

export const api = createApi(supabase, { compressImage })
export const geo = createGeo(supabase)
export const auth = createSupabaseAuth(supabase)

// Re-export types for convenience
export type {
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
