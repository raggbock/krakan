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
      /**
       * @deprecated Use the `booking-create` edge function instead.
       * This method inserts directly into the bookings table, bypassing
       * Stripe payment creation, idempotency checks, free/auto-accept
       * logic, and publication validation. It exists only for legacy
       * compatibility and should NOT be used in new code.
       */
      create: bookingsRepo.create.bind(bookingsRepo),
      listByUser: bookingsRepo.listByUser.bind(bookingsRepo),
      listByMarket: bookingsRepo.listByMarket.bind(bookingsRepo),
      updateStatus: bookingsRepo.updateStatus.bind(bookingsRepo),
      availableDates: bookingsRepo.availableDates.bind(bookingsRepo),
    },
  }
}
