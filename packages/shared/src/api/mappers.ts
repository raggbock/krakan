/**
 * Typed row shapes returned by Supabase joins, and pure mapper functions
 * that convert them to domain types.
 *
 * These types describe what Supabase actually returns for each query's
 * .select() shape. Keeping them here means column renames surface as
 * TypeScript errors in the mappers, not as runtime crashes in components.
 */

import type {
  FleaMarketDetails,
  BookingWithDetails,
  RouteWithStops,
  RouteSummary,
  RouteStop,
} from '../types'

// --- Row types (what Supabase returns) ---

type ProfileJoin = { first_name: string | null; last_name: string | null } | null

type MarketTableJoin = {
  label: string
  description: string | null
  size_description: string | null
} | null

type OpeningHourJoin = {
  day_of_week: number | null
  date: string | null
  open_time: string
  close_time: string
}

type FleaMarketJoin = {
  id: string
  name: string
  description: string | null
  street: string | null
  zip_code: string | null
  city: string | null
  country: string | null
  is_permanent: boolean
  latitude: number
  longitude: number
  opening_hours: OpeningHourJoin[]
} | null

type RouteStopJoin = {
  id: string
  sort_order: number
  flea_market_id: string
  flea_markets: FleaMarketJoin
}

// --- Helpers ---

export function formatName(profile: ProfileJoin): string {
  if (!profile) return ''
  return `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
}

// --- Flea Market mappers ---

export type FleaMarketDetailsRow = Record<string, unknown> & {
  profiles: ProfileJoin
}

export function mapFleaMarketDetails(row: FleaMarketDetailsRow): FleaMarketDetails {
  const { profiles, ...rest } = row
  return {
    ...rest,
    organizerName: formatName(profiles),
  } as FleaMarketDetails
}

// --- Booking mappers ---

export type BookingRow = Record<string, unknown> & {
  market_tables: MarketTableJoin
  flea_markets?: { name: string; city: string } | null
  profiles?: ProfileJoin
}

export function mapBookingForUser(row: BookingRow): BookingWithDetails {
  const { market_tables, flea_markets, ...rest } = row
  return {
    ...rest,
    market_table: market_tables,
    flea_market: flea_markets ?? null,
    booker: null,
  } as BookingWithDetails
}

export function mapBookingForOrganizer(row: BookingRow): BookingWithDetails {
  const { market_tables, profiles, ...rest } = row
  return {
    ...rest,
    market_table: market_tables,
    flea_market: null,
    booker: profiles ?? null,
  } as BookingWithDetails
}

// --- Route mappers ---

export type RouteDetailsRow = Record<string, unknown> & {
  profiles: ProfileJoin
  route_stops: RouteStopJoin[]
}

export function mapRouteWithStops(row: RouteDetailsRow): RouteWithStops {
  const { profiles, route_stops, ...rest } = row
  const stops = [...route_stops]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rs) => ({
      id: rs.id,
      sortOrder: rs.sort_order,
      fleaMarket: rs.flea_markets
        ? { ...rs.flea_markets, openingHours: rs.flea_markets.opening_hours ?? [] }
        : null,
    })) as RouteStop[]

  return {
    ...rest,
    creatorName: formatName(profiles),
    stops,
  } as RouteWithStops
}

export type RouteSummaryRow = Record<string, unknown> & {
  route_stops: { id: string }[]
}

export function mapRouteSummary(row: RouteSummaryRow): RouteSummary {
  const { route_stops, ...rest } = row
  return {
    ...rest,
    stopCount: route_stops?.length ?? 0,
  } as RouteSummary
}
