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
  | 'stripe.card_declined'
  | 'stripe.authentication_required'
  | 'stripe.network_error'
  | 'geocode.not_found'
  | 'auth.required'
  | 'input.invalid'
  | 'unknown'

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
  'booking.duplicate',
  'booking.table_unavailable',
  'stripe.not_onboarded',
  'stripe.capture_failed',
  'stripe.card_declined',
  'stripe.authentication_required',
  'stripe.network_error',
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

/**
 * Convert any thrown value to an AppError.
 *
 * - If already an AppError → returned as-is.
 * - If an Error with a recognisable message → mapped to a specific code.
 * - Otherwise → appError('unknown').
 *
 * Pattern matching is intentionally straightforward: substring checks on
 * `err.message` so the same helper works for both Stripe SDK errors and
 * errors surfaced from our own edge functions.
 */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof Error) {
    const msg = err.message
    if (msg.includes('card_declined')) return appError('stripe.card_declined')
    // Match "3ds" as a word (case-insensitive) or explicit "3d secure" variants,
    // but not "3dsmax" or arbitrary substrings that happen to contain those letters.
    if (
      msg.includes('authentication_required') ||
      /\b3ds\b/i.test(msg) ||
      /\b3d[_ -]?secure\b/i.test(msg)
    )
      return appError('stripe.authentication_required')
    if (msg.includes('capture_failed')) return appError('stripe.capture_failed')
    if (/not authenticated/i.test(msg)) return appError('auth.required')
    if (
      /failed to fetch/i.test(msg) ||
      /network error/i.test(msg) ||
      msg.includes('ERR_NETWORK')
    )
      return appError('stripe.network_error')
  }
  return appError('unknown')
}
