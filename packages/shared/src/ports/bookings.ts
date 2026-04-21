import type { CreateBookingPayload, BookingWithDetails } from '../types'
import type { BookingView } from '../types/domain'

export interface BookingRepository {
  /**
   * @deprecated Use the `booking-create` edge function instead.
   * Direct insert bypasses Stripe, idempotency, free/auto-accept logic,
   * and publication validation. For legacy compatibility only.
   */
  create(payload: CreateBookingPayload): Promise<{ id: string }>
  listByUser(userId: string): Promise<BookingWithDetails[]>
  listByMarket(fleaMarketId: string): Promise<BookingView[]>
  updateStatus(
    id: string,
    newStatus: 'confirmed' | 'denied' | 'cancelled',
    note?: string,
  ): Promise<void>
  availableDates(marketTableId: string): Promise<string[]>
}
