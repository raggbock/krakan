import { createBookingService, createSupabaseBookings, type BookingServiceApi } from '@fyndstigen/shared'
import { supabase } from './supabase'
import { endpoints } from './edge'

const bookingApi: BookingServiceApi = {
  bookings: createSupabaseBookings(supabase),
  endpoints,
}

export const bookingService = createBookingService({ api: bookingApi })
export type { BookingService } from '@fyndstigen/shared'
