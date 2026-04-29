import { createApi, createGeo, createSupabaseAuth, createBookingService } from '@fyndstigen/shared'
import { supabase } from './supabase'
import { compressImage } from './compress-image'

// Re-export edge layer so any legacy test that mocks '@/lib/api' for
// `api.endpoints` / `api.edge` keeps working without changes.
// New code should import directly from '@/lib/edge'.
export { endpoints, edge } from './edge'

// Legacy `api.*` surface. Most features still reach the backend through here.
// For FleaMarket reads (markets + marketTables), prefer the Deps container:
//   const { markets } = useDeps(); markets.list(...)
// New hook migrations should extend `Deps` (see packages/shared/src/deps.ts)
// rather than adding methods to `api.*`. See RFC #36 for the migration plan.
export const api = createApi(supabase, { compressImage })
export const geo = createGeo(supabase)
export const auth = createSupabaseAuth(supabase)

/**
 * Booking service facade — single entry point for all booking operations.
 * Prefer this over importing calculateCommission / api.endpoints['booking.create'].invoke directly.
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
