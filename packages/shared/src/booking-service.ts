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

/**
 * Narrow API surface required by createBookingService.
 * Callers can use this type to construct a minimal API object.
 */
export type BookingServiceApi = Pick<Api, 'bookings' | 'endpoints'>
import type { BookingEvent, BookingPatch } from './booking-lifecycle'
import { calculateCommission, validateBookingDate, isFreePriced } from './booking'
import type { OpeningHoursContext, BookingDateValidation } from './booking'
import { applyBookingEvent } from './booking-lifecycle'
import { toAppError } from './errors'
import type { AppError } from './errors'
import type { PaymentGateway } from './ports/payment'

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
  /** Market display name — used for telemetry only. */
  marketName: string
  /** Price in SEK for the table — used for branching and telemetry. */
  priceSek: number
}

/** Alias so consumers can reference the input type by the name used in BookingProgress. */
export type BookSubmitInput = BookRequestParams

/**
 * Event stream emitted by `BookingService.book()`.
 *
 * The terminal event is always `succeeded` or `failed`.
 * Consumers should handle all variants exhaustively; new variants may be
 * added in future minor versions — treat unknown types as ignorable no-ops.
 */
export type BookingProgress =
  | { type: 'submitted';         input: BookSubmitInput }
  | { type: 'created';           bookingId: string; requiresPayment: boolean; amountOre: number }
  | { type: 'payment-required';  bookingId: string; clientSecret: string; amountOre: number }
  | { type: 'payment-confirmed'; bookingId: string; amountOre: number }
  | { type: 'succeeded';         bookingId: string; requiresPayment: boolean }
  | { type: 'failed';            stage: 'submit' | 'create' | 'payment'; error: AppError }

export interface BookOptions {
  payment: PaymentGateway
  signal?: AbortSignal
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
   * Full client-side booking orchestration as an event stream.
   *
   * Yields `BookingProgress` events in order:
   *   submitted → created → [payment-required → payment-confirmed] → succeeded
   *
   * On any failure yields `failed` as the terminal event — never throws.
   * Telemetry is the caller's responsibility (hook consumes the stream and
   * fires posthog.capture per event type).
   */
  book(params: BookRequestParams, opts: BookOptions): AsyncIterable<BookingProgress>

  /** Organizer approves a pending booking — triggers Stripe capture server-side. */
  capture(bookingId: string): Promise<void>

  /** Cancel or deny a booking — triggers Stripe cancellation server-side. */
  cancel(bookingId: string, reason: 'denied' | 'cancelled'): Promise<void>

  /** Pure lifecycle reducer — re-export of booking-lifecycle.applyBookingEvent. */
  applyEvent(current: Booking, event: BookingEvent): BookingPatch
}

/**
 * Classify which stage failed based on whether we have a bookingId yet.
 *  - No bookingId: the create API call failed  → 'create'
 *  - bookingId present: payment confirmation failed → 'payment'
 *  - (The 'submit' stage is reserved for pre-API validation failures.)
 */
function classifyStage(bookingId: string | undefined): 'submit' | 'create' | 'payment' {
  if (bookingId === undefined) return 'create'
  return 'payment'
}

export function createBookingService(deps: { api: BookingServiceApi }): BookingService {
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

    async *book(params, { payment }) {
      yield { type: 'submitted', input: params }

      const { tableLabel: _tableLabel, marketName: _marketName, priceSek, ...createParams } = params
      const isFree = isFreePriced(priceSek)
      // amountOre is the total charged amount (price + commission) in öre.
      // For free bookings this is 0.
      const amountOre = isFree ? 0 : (calculateCommission(priceSek) + priceSek) * 100

      let bookingId: string | undefined
      try {
        const data = await api.endpoints['booking.create'].invoke(createParams)
        bookingId = data.bookingId
        const requiresPayment = !!data.clientSecret

        yield {
          type: 'created',
          bookingId,
          requiresPayment,
          amountOre,
        }

        if (requiresPayment && data.clientSecret) {
          yield {
            type: 'payment-required',
            bookingId,
            clientSecret: data.clientSecret,
            amountOre,
          }

          // confirmCardPayment resolves on success; throws on failure.
          await payment.confirmCardPayment(data.clientSecret)

          yield { type: 'payment-confirmed', bookingId, amountOre }
        }

        yield { type: 'succeeded', bookingId, requiresPayment }
      } catch (err) {
        yield {
          type: 'failed',
          stage: classifyStage(bookingId),
          error: toAppError(err),
        }
      }
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
