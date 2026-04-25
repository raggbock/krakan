/**
 * BookingQuery — owns the select string, row type, and mapper for each
 * booking query shape. Mirrors the FleaMarketQuery pattern (RFC #34).
 *
 * Three variants today:
 *   - core: scalar columns only, returns Booking (used by booking-repo for
 *           lifecycle reads/writes — no joins, deterministic shape)
 *   - withMarketAndTable: bookings joined with flea_markets + market_tables
 *           (the user's "my bookings" view)
 *   - withTableAndProfile: bookings joined with market_tables + profiles
 *           (the organizer's per-market view)
 *
 * The two view-shaped variants funnel through mapBookingView, which already
 * detects which joins are populated at runtime. They're kept separate here
 * so the select string is co-located with the variant that needs it.
 */

import type { Database } from '../types/supabase.generated'
import type { Booking } from '../types'
import type { BookingView } from '../types/domain'
import { mapBookingView, type BookingRow } from '../api/mappers'

type BookingTableRow = Database['public']['Tables']['bookings']['Row']

const CORE_COLUMNS = [
  'id', 'status', 'stripe_payment_intent_id', 'flea_market_id', 'booked_by',
  'market_table_id', 'booking_date', 'price_sek', 'commission_sek',
  'commission_rate', 'message', 'organizer_note', 'payment_status',
  'expires_at', 'created_at',
] as const

export const BookingQuery = {
  core: {
    select: CORE_COLUMNS.join(', ') as string,
    mapRow(row: Pick<BookingTableRow, typeof CORE_COLUMNS[number]>): Booking {
      return row as Booking
    },
  },

  withMarketAndTable: {
    select: `
      *,
      market_tables (label, description, size_description),
      flea_markets (name, city)
    ` as const,

    mapRow(row: BookingRow): BookingView {
      return mapBookingView(row)
    },
  },

  withTableAndProfile: {
    select: `
      *,
      market_tables (label, description, size_description),
      profiles!bookings_booked_by_fkey (first_name, last_name)
    ` as const,

    mapRow(row: BookingRow): BookingView {
      return mapBookingView(row)
    },
  },
} as const
