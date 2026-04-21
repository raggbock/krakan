/**
 * BookingService — single facade over scattered booking logic.
 *
 * Composes:
 *   - booking.ts              (commission math, validation)
 *   - booking-lifecycle.ts    (state reducer)
 *   - api/bookings.ts         (booked-dates query)
 *   - api/endpoints.ts        (typed booking-create invocation)
 *   - api/edge.ts             (capture / cancel edge calls)
 *
 * No new runtime dependencies — this is a pure composition layer.
 */

import type { Api } from './api'
import type { Booking } from './types'
import type { BookingEvent, BookingPatch } from './booking-lifecycle'
import { calculateCommission } from './booking'
import { applyBookingEvent } from './booking-lifecycle'

// Re-exported so callers need only this import surface.
export type { BookingEvent, BookingPatch }

export type DateValidation = { valid: boolean; error?: string }

export type CreateBookingParams = {
  marketTableId: string
  fleaMarketId: string
  bookingDate: string
  message?: string
}

export type BookingService = {
  /**
   * Calculate price breakdown for a given table price.
   * Commission is the platform fee; total is what the customer pays.
   */
  calculateTotal(priceSek: number): { price: number; commission: number; total: number }

  /**
   * Validate a booking date against already-booked dates.
   * `today` is injected to keep the function deterministic and testable;
   * if omitted it defaults to the current local date (YYYY-MM-DD).
   */
  validateDate(date: string, bookedDates: string[], today?: string): DateValidation

  /** Return dates already booked (pending or confirmed) for the given table. */
  getBookedDates(tableId: string): Promise<string[]>

  /** Create a booking. Returns a Stripe clientSecret when payment is required. */
  createWithPayment(params: CreateBookingParams): Promise<{ clientSecret?: string; bookingId: string }>

  /** Organizer approves a pending booking — triggers Stripe capture server-side. */
  capture(bookingId: string): Promise<void>

  /** Cancel or deny a booking — triggers Stripe cancellation server-side. */
  cancel(bookingId: string, reason: 'denied' | 'cancelled'): Promise<void>

  /** Pure lifecycle reducer — re-export of booking-lifecycle.applyBookingEvent. */
  applyEvent(current: Booking, event: BookingEvent): BookingPatch
}

export function createBookingService(deps: { api: Api }): BookingService {
  const { api } = deps

  return {
    calculateTotal(priceSek) {
      const commission = calculateCommission(priceSek)
      return { price: priceSek, commission, total: priceSek + commission }
    },

    validateDate(date, bookedDates, today) {
      const todayStr = today ?? new Date().toISOString().slice(0, 10)
      if (!date) return { valid: false, error: 'Datum krävs' }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { valid: false, error: 'Ogiltigt datumformat' }
      const d = new Date(date + 'T12:00:00')
      if (isNaN(d.getTime())) return { valid: false, error: 'Ogiltigt datum' }
      if (date < todayStr) return { valid: false, error: 'Kan inte boka i det förflutna' }
      if (bookedDates.includes(date)) return { valid: false, error: 'Redan bokat detta datum' }
      return { valid: true }
    },

    async getBookedDates(tableId) {
      return api.bookings.availableDates(tableId)
    },

    async createWithPayment(params) {
      return api.endpoints.bookingCreate(params)
    },

    async capture(bookingId) {
      await api.edge.invoke('stripe-payment-capture', { bookingId })
    },

    async cancel(bookingId, reason) {
      await api.edge.invoke('stripe-payment-cancel', { bookingId, newStatus: reason })
    },

    applyEvent(current, event) {
      return applyBookingEvent(current, event)
    },
  }
}
