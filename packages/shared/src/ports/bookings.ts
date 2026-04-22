import type { CreateBookingPayload } from '../types'
import type { BookingView } from '../types/domain'

/**
 * LegacyBookingRepository — carries the direct `create` method that bypasses
 * the edge function flow. Only implement this interface if you need to support
 * legacy callers (e.g. the mobile app). New consumers MUST NOT call `create`
 * directly — use the `booking-create` edge function instead.
 *
 * @deprecated Prefer the `booking-create` edge function for all new bookings.
 */
export interface LegacyBookingRepository {
  /**
   * @deprecated Use the `booking-create` edge function instead.
   * Direct insert bypasses Stripe, idempotency, free/auto-accept logic,
   * and publication validation. For legacy compatibility only.
   */
  create(payload: CreateBookingPayload): Promise<{ id: string }>
}

export interface BookingRepository extends LegacyBookingRepository {
  listByUser(userId: string): Promise<BookingView[]>
  listByMarket(fleaMarketId: string): Promise<BookingView[]>
  updateStatus(
    id: string,
    newStatus: 'confirmed' | 'denied' | 'cancelled',
    note?: string,
  ): Promise<void>
  availableDates(marketTableId: string): Promise<string[]>
}
