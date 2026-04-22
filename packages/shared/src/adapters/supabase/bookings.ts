import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateCommission, COMMISSION_RATE, isValidStatusTransition } from '../../booking'
import type { BookingStatus, CreateBookingPayload } from '../../types'
import {
  mapBookingViewForUser,
  mapBookingViewForOrganizer,
  type BookingRow,
} from '../../api/mappers'
import type { BookingView } from '../../types/domain'
import type { BookingRepository } from '../../ports/bookings'

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
        .select(`
          *,
          market_tables (label, description, size_description),
          flea_markets (name, city)
        `)
        .eq('booked_by', userId)
        .order('booking_date', { ascending: false })
      if (error) throw error
      return (data ?? []).map((b) => mapBookingViewForUser(b as BookingRow))
    },

    async listByMarket(fleaMarketId) {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          market_tables (label, description, size_description),
          profiles!bookings_booked_by_fkey (first_name, last_name)
        `)
        .eq('flea_market_id', fleaMarketId)
        .in('status', ['pending', 'confirmed'])
        .order('booking_date')
      if (error) throw error
      return (data ?? []).map((b) => mapBookingViewForOrganizer(b as BookingRow)) as BookingView[]
    },

    async updateStatus(id, newStatus, note) {
      const { data: current, error: fetchErr } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr

      if (!isValidStatusTransition(current.status as BookingStatus, newStatus)) {
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
  }
}
