/**
 * AppError — coded error taxonomy for Fyndstigen.
 *
 * A small, stable vocabulary of error codes that flows from domain logic /
 * edge functions up to the UI, where it is mapped to a human-readable
 * message via `messageFor(code)` (Swedish by default).
 *
 * Rule: domain and edge code return/throw error codes, never string messages.
 * `messageFor` is the single place where human-readable strings live.
 */

export type ErrorCode =
  // --- Booking: date validation ---
  | 'booking.date.required'
  | 'booking.date.invalid_format'
  | 'booking.date.invalid'
  | 'booking.date.in_past'
  | 'booking.date.already_booked'
  // --- Booking: business rules ---
  | 'booking.market_closed'
  | 'booking.market_not_found'
  | 'booking.table_not_found'
  | 'booking.duplicate'
  | 'booking.table_unavailable'
  | 'booking.not_pending'
  | 'booking.stripe_not_setup'
  // --- Stripe ---
  | 'stripe.not_onboarded'
  | 'stripe.capture_failed'
  | 'stripe.card_declined'
  | 'stripe.authentication_required'
  | 'stripe.network_error'
  // --- Geo ---
  | 'geocode.not_found'
  // --- Auth / generic ---
  | 'auth.required'
  | 'input.invalid'
  | 'unknown'

const ERROR_CODES: ReadonlySet<string> = new Set<ErrorCode>([
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

// ---------------------------------------------------------------------------
// Message catalog — Swedish (default locale)
// ---------------------------------------------------------------------------

/**
 * Interpolate `{param}` placeholders in a template string.
 * Pure synchronous map lookup + string.replace — no regex compilation per call.
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  let result = template
  for (const key of Object.keys(params)) {
    // Replace all occurrences of {key} without RegExp construction per call
    const placeholder = '{' + key + '}'
    let idx = result.indexOf(placeholder)
    while (idx !== -1) {
      result = result.slice(0, idx) + String(params[key]) + result.slice(idx + placeholder.length)
      idx = result.indexOf(placeholder, idx)
    }
  }
  return result
}

// Inline catalog — avoids a circular import and keeps the module self-contained.
// If the catalog grows large, move it back to errors/messages.sv.ts and import directly.
// This object is the single source of truth for Swedish messages at the shared layer.
// (web/src/lib/messages.sv.ts keeps UI-level messages; this catalog covers domain errors.)
import { MESSAGES_SV } from './errors/messages.sv'

/**
 * Return a Swedish user-facing message for an ErrorCode.
 *
 * @param code    - An ErrorCode value.
 * @param params  - Optional interpolation params for `{placeholder}` in the template.
 * @param _locale - Reserved for future English support. Defaults to 'sv'. Do not pass yet.
 *
 * Falls back to the 'unknown' message if `code` is not in the catalog at
 * runtime (defensive against stale wire data that bypasses the type system).
 *
 * Performance: pure synchronous map lookup + string.replace. No async, no
 * regex compilation per call.
 */
export function messageFor(
  code: ErrorCode,
  params?: Record<string, string | number>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale?: 'sv',
): string {
  const template = MESSAGES_SV[code] ?? MESSAGES_SV['unknown']
  return interpolate(template, params)
}
