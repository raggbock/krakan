import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateCommission, COMMISSION_RATE, isValidStatusTransition } from '../../booking'
import type { BookingStatus, CreateBookingPayload } from '../../types'
import type { BookingView } from '../../types/domain'
import type { BookingRepository } from '../../ports/bookings'
import { BookingQuery } from '../../query/booking'

export function createSupabaseBookings(supabase: SupabaseClient): BookingRepository {
  return {
    async create(payload) {
      const commissionSek = calculateCommission(payload.priceSek)

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          market_table_id: payload.marketTableId,
          flea_market_id: payload.fleaMarketId,
          booked_by: payload.bookedBy,
          booking_date: payload.bookingDate,
          price_sek: payload.priceSek,
          commission_sek: commissionSek,
          commission_rate: COMMISSION_RATE,
          message: payload.message,
        })
        .select('id')
        .single()
      if (error) throw error
      return { id: data.id }
    },

    async listByUser(userId) {
      const { data, error } = await supabase
        .from('bookings')
        .select(BookingQuery.withMarketAndTable.select)
        .eq('booked_by', userId)
        .order('booking_date', { ascending: false })
      if (error) throw error
      return (data ?? []).map((b) => BookingQuery.withMarketAndTable.mapRow(b as unknown as Parameters<typeof BookingQuery.withMarketAndTable.mapRow>[0]))
    },

    async listByMarket(fleaMarketId) {
      const { data, error } = await supabase
        .from('bookings')
        .select(BookingQuery.withTableAndProfile.select)
        .eq('flea_market_id', fleaMarketId)
        .in('status', ['pending', 'confirmed'])
        .order('booking_date')
      if (error) throw error
      return (data ?? []).map((b) => BookingQuery.withTableAndProfile.mapRow(b as unknown as Parameters<typeof BookingQuery.withTableAndProfile.mapRow>[0])) as BookingView[]
    },

    async updateStatus(id, newStatus, note) {
      const { data: current, error: fetchErr } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      if (!isValidStatusTransition(current.status as BookingStatus, newStatus)) {
        // eslint-disable-next-line no-restricted-syntax -- adapter-level invariant: invalid status transition is a programming error caught before reaching the DB
        throw new Error(`Kan inte ändra status från ${current.status} till ${newStatus}`)
      }

      const updates: Record<string, unknown> = { status: newStatus }
      if (note) updates.organizer_note = note
      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },

    async availableDates(marketTableId) {
      const { data, error } = await supabase
        .from('bookings')
        .select('booking_date')
        .eq('market_table_id', marketTableId)
        .in('status', ['pending', 'confirmed'])
      if (error) throw error
      return (data ?? []).map((b: Record<string, unknown>) => b.booking_date as string)
    },

    async pendingCountForOrganizer(organizerId) {
      const { data: markets, error: mErr } = await supabase
        .from('flea_markets')
        .select('id')
        .eq('organizer_id', organizerId)
        .eq('is_deleted', false)
      if (mErr) throw mErr
      const ids = (markets ?? []).map((m: { id: string }) => m.id)
      if (ids.length === 0) return 0
      const { count, error: cErr } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('flea_market_id', ids)
        .eq('status', 'pending')
      if (cErr) throw cErr
      return count ?? 0
    },
  }
}
