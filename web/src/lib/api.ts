import { createApi, createGeo } from '@fyndstigen/shared'
import { supabase } from './supabase'

export const api = createApi(supabase)
export const geo = createGeo(supabase)

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
} from '@fyndstigen/shared'
