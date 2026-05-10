import { createApi } from '@fyndstigen/shared'
import { supabase } from './supabase'

export const api = createApi(supabase)

export type {
  FleaMarket,
  FleaMarketDetails,
  FleaMarketNearBy,
  MarketTable,
  Booking,
  BookingWithDetails,
  Route,
  RouteWithStops,
  RouteSummary,
  PopularRoute,
  OrganizerProfileView as OrganizerProfile,
  OrganizerStats,
  UserProfileView as UserProfile,
} from '@fyndstigen/shared'
