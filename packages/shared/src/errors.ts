/**
 * AppError — coded error taxonomy for Fyndstigen.
 *
 * A small, stable vocabulary of error codes that flows from domain logic /
 * edge functions up to the UI, where it is mapped to a human-readable
 * message via a locale-specific catalog (see `web/src/lib/messages.sv.ts`).
 */

export type ErrorCode =
  | 'booking.duplicate'
  | 'booking.table_unavailable'
  | 'stripe.not_onboarded'
  | 'stripe.capture_failed'
  | 'geocode.not_found'
  | 'auth.required'
  | 'input.invalid'
  | 'unknown'

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'booking.duplicate',
  'booking.table_unavailable',
  'stripe.not_onboarded',
  'stripe.capture_failed',
  'geocode.not_found',
  'auth.required',
  'input.invalid',
  'unknown',
])

export type AppError = {
  code: ErrorCode
  detail?: Record<string, unknown>
}

/**
 * Construct an AppError. Detail is optional and should be a plain object
 * of structured data that message templates may interpolate.
 */
export function appError(code: ErrorCode, detail?: Record<string, unknown>): AppError {
  return detail === undefined ? { code } : { code, detail }
}

/**
 * Type guard: returns true iff `e` is a non-null object with a `code`
 * string matching one of the known ErrorCode values.
 */
export function isAppError(e: unknown): e is AppError {
  if (e === null || typeof e !== 'object') return false
  const code = (e as { code?: unknown }).code
  return typeof code === 'string' && ERROR_CODES.has(code)
}
