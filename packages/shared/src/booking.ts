import type { BookingStatus } from './types'

export const COMMISSION_RATE = 0.12

export function calculateCommission(priceSek: number, rate = COMMISSION_RATE): number {
  if (priceSek < 0) throw new Error('Price cannot be negative')
  if (rate < 0 || rate > 1) throw new Error('Rate must be between 0 and 1')
  return Math.round(priceSek * rate)
}

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'denied', 'cancelled'],
  confirmed: ['cancelled'],
  denied: [],
  cancelled: [],
}

export function isValidStatusTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function validateBookingDate(
  dateStr: string,
  bookedDates: string[],
  today: string,
): { valid: boolean; error?: string } {
  if (!dateStr) return { valid: false, error: 'Datum krävs' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { valid: false, error: 'Ogiltigt datumformat' }

  const date = new Date(dateStr + 'T12:00:00')
  if (isNaN(date.getTime())) return { valid: false, error: 'Ogiltigt datum' }
  if (dateStr < today) return { valid: false, error: 'Kan inte boka i det förflutna' }
  if (bookedDates.includes(dateStr)) return { valid: false, error: 'Redan bokat detta datum' }

  return { valid: true }
}

export function generateBatchLabels(prefix: string, count: number, startAt = 1): string[] {
  if (count < 1 || count > 100) throw new Error('Count must be 1-100')
  if (!prefix.trim()) throw new Error('Prefix is required')
  return Array.from({ length: count }, (_, i) => `${prefix.trim()} ${startAt + i}`)
}
