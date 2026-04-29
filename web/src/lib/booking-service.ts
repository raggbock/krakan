import { createBookingService, createSupabaseBookings } from '@fyndstigen/shared'
import { supabase } from './supabase'
import { endpoints } from './edge'

// createBookingService expects an Api-shape object. We provide just the
// two slices it actually uses (bookings + endpoints) and cast away the
// rest. The cast is contained to this file.
const bookingApi = {
  bookings: createSupabaseBookings(supabase),
  endpoints,
} as const

export const bookingService = createBookingService({ api: bookingApi as never })
export type { BookingService } from '@fyndstigen/shared'
