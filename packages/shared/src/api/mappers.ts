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

import type { BookingView, RouteView, RouteSummaryView, RouteStopView } from '../types/domain'
import type { Database } from '../types/supabase.generated'

type BookingTableRow = Database['public']['Tables']['bookings']['Row']
type RouteTableRow = Database['public']['Tables']['routes']['Row']

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
  slug: string | null
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

// --- Booking mappers ---

export type BookingRow = BookingTableRow & {
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
  return {
    id: row.id,
    table: row.market_tables
      ? {
          id: row.market_table_id,
          label: row.market_tables.label,
          description: row.market_tables.description,
          sizeDescription: row.market_tables.size_description,
        }
      : null,
    market: row.flea_markets
      ? {
          id: row.flea_market_id,
          name: row.flea_markets.name,
          city: row.flea_markets.city,
        }
      : null,
    booker: row.profiles
      ? {
          id: row.booked_by,
          firstName: row.profiles.first_name,
          lastName: row.profiles.last_name,
        }
      : null,
    date: row.booking_date,
    status: row.status as BookingView['status'],
    price: {
      baseSek: row.price_sek,
      commissionSek: row.commission_sek,
      commissionRate: row.commission_rate,
    },
    message: row.message,
    organizerNote: row.organizer_note,
    payment: {
      status: (row.payment_status as BookingView['payment']['status']) ?? null,
      intentId: row.stripe_payment_intent_id ?? null,
      expiresAt: row.expires_at ?? null,
    },
    createdAt: row.created_at,
  }
}

// --- Route mappers ---

export type RouteDetailsRow = RouteTableRow & {
  profiles: ProfileJoin
  route_stops: RouteStopJoin[]
}

export function mapRouteView(row: RouteDetailsRow): RouteView {
  const { profiles, route_stops, ...rest } = row
  const stops: RouteStopView[] = [...route_stops]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((rs) => ({
      id: rs.id,
      sortOrder: rs.sort_order,
      fleaMarket: rs.flea_markets
        ? {
            id: rs.flea_markets.id,
            name: rs.flea_markets.name,
            description: rs.flea_markets.description ?? '',
            street: rs.flea_markets.street ?? '',
            zipCode: rs.flea_markets.zip_code ?? '',
            city: rs.flea_markets.city ?? '',
            country: rs.flea_markets.country ?? '',
            isPermanent: rs.flea_markets.is_permanent,
            latitude: rs.flea_markets.latitude,
            longitude: rs.flea_markets.longitude,
            publishedAt: null,
            organizerId: '',
            autoAcceptBookings: false,
            createdAt: '',
            slug: rs.flea_markets.slug,
            openingHourRules: (rs.flea_markets.opening_hour_rules ?? []).map((r) => ({
              id: r.id,
              type: r.type as import('../types/shared-enums').RuleType,
              dayOfWeek: r.day_of_week,
              anchorDate: r.anchor_date,
              openTime: r.open_time,
              closeTime: r.close_time,
            })),
            openingHourExceptions: (rs.flea_markets.opening_hour_exceptions ?? []).map((e) => ({
              id: e.id,
              date: e.date,
              reason: e.reason,
            })),
          }
        : null,
    }))

  return {
    id: rest.id,
    name: rest.name,
    description: rest.description,
    createdBy: rest.created_by,
    creatorName: formatName(profiles),
    startLatitude: rest.start_latitude,
    startLongitude: rest.start_longitude,
    plannedDate: rest.planned_date,
    isPublished: rest.is_published,
    publishedAt: rest.published_at,
    isDeleted: rest.is_deleted,
    createdAt: rest.created_at,
    updatedAt: rest.updated_at,
    stops,
  }
}

export type RouteSummaryRow = RouteTableRow & {
  route_stops: { id: string }[]
}

export function mapRouteSummaryView(row: RouteSummaryRow): RouteSummaryView {
  const { route_stops, ...rest } = row
  return {
    id: rest.id,
    name: rest.name,
    description: rest.description,
    createdBy: rest.created_by,
    startLatitude: rest.start_latitude,
    startLongitude: rest.start_longitude,
    plannedDate: rest.planned_date,
    isPublished: rest.is_published,
    publishedAt: rest.published_at,
    isDeleted: rest.is_deleted,
    createdAt: rest.created_at,
    updatedAt: rest.updated_at,
    stopCount: route_stops?.length ?? 0,
  }
}
