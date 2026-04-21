import { describe, it, expect } from 'vitest'
import { appError, isAppError, type AppError, type ErrorCode } from './errors'

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
    const codes: ErrorCode[] = [
      'booking.duplicate',
      'booking.table_unavailable',
      'stripe.not_onboarded',
      'stripe.capture_failed',
      'geocode.not_found',
      'auth.required',
      'input.invalid',
      'unknown',
    ]
    for (const c of codes) {
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
    const codes: ErrorCode[] = [
      'booking.duplicate',
      'booking.table_unavailable',
      'stripe.not_onboarded',
      'stripe.capture_failed',
      'geocode.not_found',
      'auth.required',
      'input.invalid',
      'unknown',
    ]
    for (const c of codes) {
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
