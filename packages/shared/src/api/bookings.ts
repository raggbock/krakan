import type { SupabaseClient } from '@supabase/supabase-js'
import { calculateCommission, COMMISSION_RATE, isValidStatusTransition } from '../booking'
import type { BookingStatus, CreateBookingPayload } from '../types'
import { mapBookingForUser, mapBookingForOrganizer, type BookingRow } from './mappers'

export function createBookingsApi(supabase: SupabaseClient) {
  return {
    bookings: {
      create: async (payload: CreateBookingPayload) => {
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

      listByUser: async (userId: string) => {
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
        return (data ?? []).map((b) => mapBookingForUser(b as BookingRow))
      },

      listByMarket: async (fleaMarketId: string) => {
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
        return (data ?? []).map((b) => mapBookingForOrganizer(b as BookingRow))
      },

      updateStatus: async (id: string, newStatus: 'confirmed' | 'denied' | 'cancelled', note?: string) => {
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

      availableDates: async (marketTableId: string) => {
        const { data, error } = await supabase
          .from('bookings')
          .select('booking_date')
          .eq('market_table_id', marketTableId)
          .in('status', ['pending', 'confirmed'])
        if (error) throw error
        return (data ?? []).map((b: Record<string, unknown>) => b.booking_date as string)
      },
    },
  }
}
