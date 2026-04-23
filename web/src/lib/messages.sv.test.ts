import { describe, it, expect } from 'vitest'
import { appError, type ErrorCode } from '@fyndstigen/shared'
import { MESSAGES, messageFor } from './messages.sv'

// The canonical list of codes. The `satisfies` ensures that if a new
// ErrorCode is added to the union, TypeScript will flag this array as
// incomplete — forcing the test (and therefore the catalog) to be updated.
const ALL_CODES = [
  'booking.date.required',
  'booking.date.invalid_format',
  'booking.date.invalid',
  'booking.date.in_past',
  'booking.date.already_booked',
  'booking.market_closed',
  'booking.market_not_found',
  'booking.table_not_found',
  'booking.duplicate',
  'booking.table_unavailable',
  'booking.not_pending',
  'booking.stripe_not_setup',
  'stripe.not_onboarded',
  'stripe.capture_failed',
  'stripe.card_declined',
  'stripe.authentication_required',
  'stripe.network_error',
  'geocode.not_found',
  'auth.required',
  'input.invalid',
  'unknown',
] as const satisfies readonly ErrorCode[]

// Exhaustiveness assertion: if a new ErrorCode is added, this type-level
// check will fail at typecheck time, because the tuple would no longer
// cover the union.
type _Exhaustive = Exclude<ErrorCode, (typeof ALL_CODES)[number]> extends never
  ? true
  : false
const _exhaustive: _Exhaustive = true
void _exhaustive

describe('MESSAGES catalog', () => {
  it('has an entry for every ErrorCode', () => {
    const keys = Object.keys(MESSAGES) as ErrorCode[]
    expect(keys.sort()).toEqual([...ALL_CODES].sort())
  })

  it.each(ALL_CODES)('returns a non-empty Swedish string for code %s', (code) => {
    const template = MESSAGES[code]
    expect(typeof template).toBe('function')
    const msg = template()
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
    expect(msg.trim()).toBe(msg.length > 0 ? msg.trim() : '')
  })
})

describe('messageFor', () => {
  it.each(ALL_CODES)('returns a non-empty string for AppError with code %s', (code) => {
    const msg = messageFor(appError(code))
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  it('ignores detail when the template does not use it', () => {
    const a = messageFor(appError('booking.duplicate'))
    const b = messageFor(appError('booking.duplicate', { tableId: 't-1' }))
    expect(a).toBe(b)
  })

  it('falls back to the unknown message if code is missing from catalog at runtime', () => {
    // Cast through unknown to simulate a malformed runtime value that
    // somehow bypassed the type system (e.g. stale data from the wire).
    const bogus = { code: 'not.in.catalog' } as unknown as Parameters<typeof messageFor>[0]
    expect(messageFor(bogus)).toBe(MESSAGES.unknown())
  })
})
