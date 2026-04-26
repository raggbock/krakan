import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseBookings } from '../adapters/supabase/bookings'

/**
 * Creates the bookings API namespace.
 * Internally delegates to the Supabase adapter; the outer shape is
 * preserved for back-compat with existing callers.
 */
export function createBookingsApi(supabase: SupabaseClient) {
  const bookingsRepo = createSupabaseBookings(supabase)

  return {
    bookings: {
      // No `create` method — booking creation goes through the
      // `booking-create` edge function so Stripe payments, idempotency,
      // free/auto-accept logic, and publication validation stay enforced.
      listByUser: bookingsRepo.listByUser.bind(bookingsRepo),
      listByMarket: bookingsRepo.listByMarket.bind(bookingsRepo),
      updateStatus: bookingsRepo.updateStatus.bind(bookingsRepo),
      availableDates: bookingsRepo.availableDates.bind(bookingsRepo),
    },
  }
}
