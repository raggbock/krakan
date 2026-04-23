import { describe, it, expect } from 'vitest'
import { appError, isAppError, toAppError, messageFor, interpolate, type AppError, type ErrorCode } from './errors'

const ALL_CODES: ErrorCode[] = [
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
  'auth.forbidden',
  'input.invalid',
  'unknown',
]

describe('appError', () => {
  it('constructs an AppError with just a code', () => {
    const err = appError('booking.duplicate')
    expect(err).toEqual({ code: 'booking.duplicate' })
    expect(err.detail).toBeUndefined()
  })

  it('constructs an AppError with code and detail', () => {
    const err = appError('booking.table_unavailable', { tableId: 't-1' })
    expect(err).toEqual({
      code: 'booking.table_unavailable',
      detail: { tableId: 't-1' },
    })
  })

  it('omits detail key entirely when undefined is passed', () => {
    const err = appError('unknown', undefined)
    expect(Object.prototype.hasOwnProperty.call(err, 'detail')).toBe(false)
  })

  it('accepts all known error codes', () => {
    for (const c of ALL_CODES) {
      expect(appError(c).code).toBe(c)
    }
  })
})

describe('isAppError', () => {
  it('returns true for a well-formed AppError', () => {
    expect(isAppError({ code: 'booking.duplicate' })).toBe(true)
    expect(isAppError({ code: 'stripe.not_onboarded', detail: { x: 1 } })).toBe(true)
  })

  it('returns true for every known ErrorCode', () => {
    for (const c of ALL_CODES) {
      expect(isAppError({ code: c })).toBe(true)
    }
  })

  it('narrows the type when used as a guard', () => {
    const e: unknown = { code: 'auth.required' }
    if (isAppError(e)) {
      // Type-level assertion: detail is typed, code is ErrorCode.
      const narrowed: AppError = e
      expect(narrowed.code).toBe('auth.required')
    } else {
      throw new Error('should have narrowed')
    }
  })

  it('returns false for null', () => {
    expect(isAppError(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isAppError(undefined)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isAppError('booking.duplicate')).toBe(false)
    expect(isAppError(42)).toBe(false)
    expect(isAppError(true)).toBe(false)
  })

  it('returns false for an object without a code', () => {
    expect(isAppError({})).toBe(false)
    expect(isAppError({ detail: { x: 1 } })).toBe(false)
  })

  it('returns false when code is not a string', () => {
    expect(isAppError({ code: 123 })).toBe(false)
    expect(isAppError({ code: null })).toBe(false)
  })

  it('returns false for an unknown code string', () => {
    expect(isAppError({ code: 'not.a.real.code' })).toBe(false)
    expect(isAppError({ code: '' })).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isAppError(['booking.duplicate'])).toBe(false)
  })
})

describe('toAppError', () => {
  it('passes through an existing AppError unchanged', () => {
    const original = appError('booking.duplicate')
    expect(toAppError(original)).toBe(original)
  })

  it('passes through an AppError with detail unchanged', () => {
    const original = appError('stripe.capture_failed', { reason: 'timeout' })
    expect(toAppError(original)).toBe(original)
  })

  it.each([
    ['Your card_declined by issuer', 'stripe.card_declined'],
    ['Error: card_declined', 'stripe.card_declined'],
    ['authentication_required for this payment', 'stripe.authentication_required'],
    ['3DS verification required', 'stripe.authentication_required'],
    ['3ds challenge needed', 'stripe.authentication_required'],
    ['capture_failed due to dispute', 'stripe.capture_failed'],
    ['Not authenticated', 'auth.required'],
    ['not authenticated — session expired', 'auth.required'],
    ['Failed to fetch', 'stripe.network_error'],
    ['failed to fetch resource', 'stripe.network_error'],
    ['Network Error occurred', 'stripe.network_error'],
    ['network error: timeout', 'stripe.network_error'],
    ['ERR_NETWORK', 'stripe.network_error'],
  ] as const)('maps message "%s" → code %s', (message, expectedCode) => {
    const err = new Error(message)
    expect(toAppError(err).code).toBe(expectedCode)
  })

  it('falls back to unknown for an unrecognised Error message', () => {
    expect(toAppError(new Error('Something totally unexpected')).code).toBe('unknown')
  })

  it('falls back to unknown for a plain string', () => {
    expect(toAppError('card_declined').code).toBe('unknown')
  })

  it('falls back to unknown for null', () => {
    expect(toAppError(null).code).toBe('unknown')
  })

  it('falls back to unknown for undefined', () => {
    expect(toAppError(undefined).code).toBe('unknown')
  })

  it('falls back to unknown for a plain object', () => {
    expect(toAppError({ message: 'card_declined' }).code).toBe('unknown')
  })
})

// ---------------------------------------------------------------------------
// messageFor
// ---------------------------------------------------------------------------

describe('messageFor', () => {
  it('returns a non-empty Swedish string for every ErrorCode', () => {
    for (const code of ALL_CODES) {
      const msg = messageFor(code)
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })

  it('returns Swedish for booking.date.in_past', () => {
    expect(messageFor('booking.date.in_past')).toBe('Kan inte boka i det förflutna')
  })

  it('returns Swedish for booking.date.required', () => {
    expect(messageFor('booking.date.required')).toBe('Datum krävs')
  })

  it('returns Swedish for booking.date.already_booked', () => {
    expect(messageFor('booking.date.already_booked')).toBe('Redan bokat detta datum')
  })

  it('returns Swedish for booking.market_closed', () => {
    expect(messageFor('booking.market_closed')).toBe('Marknaden är stängd det valda datumet')
  })

  it('interpolates {param} placeholders when params are provided', () => {
    // Use unknown cast to test interpolation with a hypothetical param
    // The current catalog has no templated entries; this tests the mechanism.
    const result = messageFor('unknown', { foo: 'bar' })
    // 'unknown' message doesn't have {foo}, so output is unchanged
    expect(result).toBe('Något gick fel. Försök igen om en liten stund.')
  })

  it('falls back to unknown message for an unrecognised code at runtime', () => {
    const bogusCode = 'not.a.real.code' as ErrorCode
    expect(messageFor(bogusCode)).toBe('Något gick fel. Försök igen om en liten stund.')
  })
})

// ---------------------------------------------------------------------------
// interpolate
// ---------------------------------------------------------------------------

describe('interpolate', () => {
  it('returns the template unchanged when no params', () => {
    expect(interpolate('Hello world')).toBe('Hello world')
    expect(interpolate('Hello world', undefined)).toBe('Hello world')
  })

  it('replaces a single placeholder', () => {
    expect(interpolate('Datum: {date}', { date: '2026-04-22' })).toBe('Datum: 2026-04-22')
  })

  it('replaces multiple distinct placeholders', () => {
    expect(interpolate('{a} och {b}', { a: 'ett', b: 'två' })).toBe('ett och två')
  })

  it('replaces all occurrences of the same placeholder', () => {
    expect(interpolate('{x} {x} {x}', { x: 'ping' })).toBe('ping ping ping')
  })

  it('coerces number params to strings', () => {
    expect(interpolate('Antal: {n}', { n: 42 })).toBe('Antal: 42')
  })

  it('leaves unknown placeholders intact', () => {
    expect(interpolate('{known} {unknown}', { known: 'ok' })).toBe('ok {unknown}')
  })
})
