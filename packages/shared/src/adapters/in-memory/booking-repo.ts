/**
 * In-memory adapter for BookingRepo — for use in tests.
 *
 * Uses the same applyBookingEvent reducer as the Supabase adapter.
 * `applyEvent` is non-atomic but deterministic (single-process, synchronous
 * store), which is correct for unit tests.
 */

import { applyBookingEvent } from '../../booking-lifecycle'
import type { BookingEvent } from '../../booking-lifecycle'
import type { Booking } from '../../types'
import type { BookingRepo } from '../../ports/booking-repo'

let _id = 1

export function createInMemoryBookingRepo(seed: Booking[] = []): BookingRepo {
  const store = new Map<string, Booking>(seed.map((b) => [b.id, { ...b }]))

  function nextId() {
    return `bk-repo-${_id++}`
  }

  /**
   * Convenience: insert a booking directly into the store (not part of the
   * BookingRepo interface — test setup only).
   */
  function insert(booking: Omit<Booking, 'id'> & { id?: string }): Booking {
    const id = booking.id ?? nextId()
    const full: Booking = { ...booking, id } as Booking
    store.set(id, full)
    return full
  }

  const repo: BookingRepo & { _insert: typeof insert } = {
    _insert: insert,

    async findById(id) {
      return store.get(id) ?? null
    },

    async findByPaymentIntent(paymentIntentId) {
      for (const b of store.values()) {
        if (b.stripe_payment_intent_id === paymentIntentId) return { ...b }
      }
      return null
    },

    async applyEvent(id, event) {
      const current = store.get(id)
      if (!current) throw new Error(`Booking ${id} not found`)

      const patch = applyBookingEvent(current, event)
      if (Object.keys(patch).length === 0) return { ...current }

      const updated: Booking = { ...current, ...patch } as Booking
      store.set(id, updated)
      return { ...updated }
    },
  }

  return repo
}

/**
 * Type guard to access the test-only `_insert` helper on an
 * in-memory repo created by `createInMemoryBookingRepo`.
 */
export type InMemoryBookingRepo = BookingRepo & {
  _insert(booking: Omit<Booking, 'id'> & { id?: string }): Booking
}
