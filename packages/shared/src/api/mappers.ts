/**
 * Typed row shapes returned by Supabase joins, and pure mapper functions
 * that convert them to domain types.
 *
 * These types describe what Supabase actually returns for each query's
 * .select() shape. Keeping them here means column renames surface as
 * TypeScript errors in the mappers, not as runtime crashes in components.
 *
 * Booking mapper: mapBookingView(row) → BookingView (camelCase)
 *   - Fills booker when row.profiles is present, otherwise null
 *   - Fills market when row.flea_markets is present, otherwise null
 *   - Fills table when row.market_tables is present, otherwise null
 */

import type {
  FleaMarketDetails,
  RouteWithStops,
  RouteSummary,
  RouteStop,
} from '../types'
import type { BookingView } from '../types/domain'

// --- Row types (what Supabase returns) ---

type ProfileJoin = { first_name: string | null; last_name: string | null } | null

type MarketTableJoin = {
  label: string
  description: string | null
  size_description: string | null
} | null

type OpeningHourRuleJoin = {
  id: string
  type: string
  day_of_week: number | null
  anchor_date: string | null
  open_time: string
  close_time: string
}

type OpeningHourExceptionJoin = {
  id: string
  date: string
  reason: string | null
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
  opening_hour_rules: OpeningHourRuleJoin[]
  opening_hour_exceptions: OpeningHourExceptionJoin[]
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
  market_tables?: MarketTableJoin | null
  flea_markets?: { name: string; city: string } | null
  profiles?: ProfileJoin
}

// --- BookingView mapper ---

/**
 * Maps a Supabase booking row to a BookingView (camelCase domain type).
 *
 * Detects joined relations at runtime:
 *   - Fills table  when row.market_tables is present, otherwise null
 *   - Fills market when row.flea_markets  is present, otherwise null
 *   - Fills booker when row.profiles      is present, otherwise null
 *
 * This single function covers both the user (flea_markets join, no profiles)
 * and organizer (profiles join, no flea_markets) query shapes.
 */
export function mapBookingView(row: BookingRow): BookingView {
  const r = row as Record<string, unknown>
  return {
    id: r.id as string,
    table: row.market_tables
      ? {
          id: r.market_table_id as string,
          label: row.market_tables.label,
          description: row.market_tables.description,
          sizeDescription: row.market_tables.size_description,
        }
      : null,
    market: row.flea_markets
      ? {
          id: r.flea_market_id as string,
          name: row.flea_markets.name,
          city: row.flea_markets.city,
        }
      : null,
    booker: row.profiles
      ? {
          id: r.booked_by as string,
          firstName: row.profiles.first_name,
          lastName: row.profiles.last_name,
        }
      : null,
    date: r.booking_date as string,
    status: r.status as BookingView['status'],
    price: {
      baseSek: r.price_sek as number,
      commissionSek: r.commission_sek as number,
      commissionRate: r.commission_rate as number,
    },
    message: r.message as string | null,
    organizerNote: r.organizer_note as string | null,
    payment: {
      status: (r.payment_status as BookingView['payment']['status']) ?? null,
      intentId: (r.stripe_payment_intent_id as string | null) ?? null,
      expiresAt: (r.expires_at as string | null) ?? null,
    },
    createdAt: r.created_at as string,
  }
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
        ? {
            ...rs.flea_markets,
            opening_hour_rules: rs.flea_markets.opening_hour_rules ?? [],
            opening_hour_exceptions: rs.flea_markets.opening_hour_exceptions ?? [],
          }
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
