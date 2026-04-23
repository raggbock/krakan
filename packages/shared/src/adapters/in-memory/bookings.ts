import { calculateCommission, COMMISSION_RATE, isValidStatusTransition } from '../../booking'
import type { BookingStatus, CreateBookingPayload } from '../../types'
import type { BookingView } from '../../types/domain'
import type { BookingRepository } from '../../ports/bookings'

type StoredBooking = {
  id: string
  market_table_id: string
  flea_market_id: string
  booked_by: string
  booking_date: string
  price_sek: number
  commission_sek: number
  commission_rate: number
  message: string | null
  status: BookingStatus
  organizer_note: string | null
  payment_status: string | null
  stripe_payment_intent_id: string | null
  expires_at: string | null
  created_at: string
}

let _bid = 1

export function createInMemoryBookings(seed: StoredBooking[] = []): BookingRepository {
  const store = new Map<string, StoredBooking>(seed.map((b) => [b.id, { ...b }]))

  return {
    async create(payload: CreateBookingPayload) {
      const id = `bk-${_bid++}`
      const now = new Date().toISOString()
      const booking: StoredBooking = {
        id,
        market_table_id: payload.marketTableId,
        flea_market_id: payload.fleaMarketId,
        booked_by: payload.bookedBy,
        booking_date: payload.bookingDate,
        price_sek: payload.priceSek,
        commission_sek: calculateCommission(payload.priceSek),
        commission_rate: COMMISSION_RATE,
        message: payload.message ?? null,
        status: 'pending',
        organizer_note: null,
        payment_status: null,
        stripe_payment_intent_id: null,
        expires_at: null,
        created_at: now,
      }
      store.set(id, booking)
      return { id }
    },

    async listByUser(userId: string): Promise<BookingView[]> {
      return Array.from(store.values())
        .filter((b) => b.booked_by === userId)
        .map((b): BookingView => ({
          id: b.id,
          table: null,
          market: null,
          booker: null,
          date: b.booking_date,
          status: b.status,
          price: {
            baseSek: b.price_sek,
            commissionSek: b.commission_sek,
            commissionRate: b.commission_rate,
          },
          message: b.message,
          organizerNote: b.organizer_note,
          payment: {
            status: b.payment_status as BookingView['payment']['status'],
            intentId: b.stripe_payment_intent_id,
            expiresAt: b.expires_at,
          },
          createdAt: b.created_at,
        }))
    },

    async listByMarket(fleaMarketId: string): Promise<BookingView[]> {
      return Array.from(store.values())
        .filter(
          (b) =>
            b.flea_market_id === fleaMarketId &&
            (b.status === 'pending' || b.status === 'confirmed'),
        )
        .map((b): BookingView => ({
          id: b.id,
          table: null,
          market: null,
          booker: null,
          date: b.booking_date,
          status: b.status,
          price: {
            baseSek: b.price_sek,
            commissionSek: b.commission_sek,
            commissionRate: b.commission_rate,
          },
          message: b.message,
          organizerNote: b.organizer_note,
          payment: {
            status: b.payment_status as BookingView['payment']['status'],
            intentId: b.stripe_payment_intent_id,
            expiresAt: b.expires_at,
          },
          createdAt: b.created_at,
        }))
    },

    async updateStatus(id, newStatus, note) {
      const existing = store.get(id)
      // eslint-disable-next-line no-restricted-syntax -- in-memory test double: missing ID is a test-setup error, not a user-facing error
      if (!existing) throw new Error(`Booking ${id} not found`)
      if (!isValidStatusTransition(existing.status, newStatus)) {
        // eslint-disable-next-line no-restricted-syntax -- in-memory test double: invalid transition is a test-setup error, not a user-facing error
        throw new Error(`Kan inte ändra status från ${existing.status} till ${newStatus}`)
      }
      store.set(id, {
        ...existing,
        status: newStatus,
        organizer_note: note ?? existing.organizer_note,
      })
    },

    async availableDates(marketTableId: string): Promise<string[]> {
      return Array.from(store.values())
        .filter(
          (b) =>
            b.market_table_id === marketTableId &&
            (b.status === 'pending' || b.status === 'confirmed'),
        )
        .map((b) => b.booking_date)
    },
  }
}
