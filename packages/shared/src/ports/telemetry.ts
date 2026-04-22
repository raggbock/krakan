/**
 * Telemetry port — abstracts analytics event emission.
 *
 * Surface based on what useBooking actually fires. Each event maps to
 * a concrete PostHog event in the web adapter.
 */
export interface Telemetry {
  capture(event: TelemetryEvent): void
}

export type TelemetryEvent = BookingInitiated | BookingCompleted

export type BookingInitiated = {
  name: 'booking_initiated'
  properties: {
    flea_market_id: string
    market_name: string
    table_label: string
    price_sek: number
    is_free: boolean
  }
}

export type BookingCompleted = {
  name: 'booking_completed'
  properties: {
    flea_market_id: string
    booking_id: string
    is_free: boolean
  }
}
