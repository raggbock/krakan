import type { BookingView } from '../types/domain'

/**
 * BookingRepository — query-side surface for the bookings table.
 *
 * Lifecycle-aware persistence (findById, applyEvent, etc.) lives in
 * BookingRepo (./booking-repo.ts) — the names are similar but the
 * concerns are distinct: this port is for "give me a list of bookings",
 * the other is "transition this booking through its state machine".
 *
 * No `create()` method here — all booking creation must go through the
 * `booking-create` edge function so Stripe + idempotency + free-auto-
 * accept rules stay enforced. The previous LegacyBookingRepository.create
 * shim was deleted on 2026-04-26 after a usage audit found zero callers.
 */
export interface BookingRepository {
  listByUser(userId: string): Promise<BookingView[]>
  listByMarket(fleaMarketId: string): Promise<BookingView[]>
  updateStatus(
    id: string,
    newStatus: 'confirmed' | 'denied' | 'cancelled',
    note?: string,
  ): Promise<void>
  availableDates(marketTableId: string): Promise<string[]>
  /**
   * Count of pending bookings across all of an organizer's non-deleted markets.
   * Used by the organizer's pending-bookings badge in profile UI.
   * Returns 0 if the organizer has no markets.
   */
  pendingCountForOrganizer(organizerId: string): Promise<number>
}
