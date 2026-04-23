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
import { calculateCommission, validateBookingDate, isFreePriced } from './booking'
import type { OpeningHoursContext, BookingDateValidation } from './booking'
import { applyBookingEvent } from './booking-lifecycle'
import { toAppError } from './errors'
import type { PaymentGateway } from './ports/payment'
import type { Telemetry } from './ports/telemetry'

// Re-exported so callers need only this import surface.
// OpeningHoursContext stays canonical in ./booking.ts — re-exported from the
// package root in ./index.ts. Don't re-export it a second time here.
export type { BookingEvent, BookingPatch }

/** @deprecated Use BookingDateValidation from './booking' directly. */
export type DateValidation = BookingDateValidation

export type CreateBookingParams = {
  marketTableId: string
  fleaMarketId: string
  bookingDate: string
  message?: string
}

export type BookRequestParams = CreateBookingParams & {
  /** Label shown to the user (e.g. table.label) — used for telemetry only. */
  tableLabel: string
  /** Price in SEK for the table — used for branching and telemetry. */
  priceSek: number
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
   * When `openingHours` is supplied, also validates that the date falls on an
   * open day according to the market's rules and exceptions.
   */
  validateDate(date: string, bookedDates: string[], today?: string, openingHours?: OpeningHoursContext): BookingDateValidation

  /** Return dates already booked (pending or confirmed) for the given table. */
  getBookedDates(tableId: string): Promise<string[]>

  /** Create a booking. Returns a Stripe clientSecret when payment is required. */
  createWithPayment(params: CreateBookingParams): Promise<{ clientSecret?: string; bookingId: string }>

  /**
   * Full client-side booking orchestration:
   *   1. Emits booking_initiated telemetry
   *   2. Calls the edge endpoint
   *   3. If clientSecret present, confirms payment via PaymentGateway
   *
   * Throws on network or payment failure so the caller can handle errors.
   */
  book(params: BookRequestParams, ports: { payment: PaymentGateway; telemetry: Telemetry }): Promise<{ bookingId: string }>

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

    validateDate(date, bookedDates, today, openingHours) {
      return validateBookingDate(
        date,
        bookedDates,
        today ?? new Date().toISOString().slice(0, 10),
        openingHours,
      )
    },

    async getBookedDates(tableId) {
      return api.bookings.availableDates(tableId)
    },

    async createWithPayment(params) {
      return api.endpoints['booking.create'].invoke(params)
    },

    async book(params, { payment, telemetry }) {
      const { tableLabel, priceSek, ...createParams } = params
      const isFree = isFreePriced(priceSek)

      telemetry.capture({
        name: 'booking_initiated',
        properties: {
          flea_market_id: params.fleaMarketId,
          market_name: tableLabel,
          table_label: tableLabel,
          price_sek: priceSek,
          is_free: isFree,
        },
      })

      const data = await api.endpoints['booking.create'].invoke(createParams)

      if (data.clientSecret) {
        const result = await payment.confirmCardPayment(data.clientSecret)
        if (result.status === 'failed') {
          throw toAppError(new Error(result.error))
        }
      }

      return { bookingId: data.bookingId }
    },

    async capture(bookingId) {
      await api.endpoints['stripe.payment.capture'].invoke({ bookingId })
    },

    async cancel(bookingId, reason) {
      await api.endpoints['stripe.payment.cancel'].invoke({ bookingId, newStatus: reason })
    },

    applyEvent(current, event) {
      return applyBookingEvent(current, event)
    },
  }
}
