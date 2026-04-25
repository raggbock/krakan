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
  | 'booking.not_found'
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
  | 'stripe.connect.account_creation_failed'
  | 'stripe.connect.no_account'
  // --- Booking: concurrent/state errors ---
  | 'booking.invalid_status'
  | 'booking.concurrent_update'
  // --- Organizer ---
  | 'organizer.fetch_failed'
  // --- Market publication ---
  | 'market.cannot_publish_without_hours'
  // --- Profile ---
  | 'profile.not_found'
  // --- Skyltfönstret subscription ---
  | 'skyltfonstret.already_subscribed'
  | 'skyltfonstret.no_subscription'
  | 'skyltfonstret.config_missing'
  // --- Geo ---
  | 'geocode.not_found'
  // --- Auth / generic ---
  | 'auth.required'
  | 'auth.forbidden'
  | 'auth.lookup_failed'
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
  'booking.not_found',
  'booking.duplicate',
  'booking.table_unavailable',
  'booking.not_pending',
  'booking.stripe_not_setup',
  'stripe.not_onboarded',
  'stripe.capture_failed',
  'stripe.card_declined',
  'stripe.authentication_required',
  'stripe.network_error',
  'stripe.connect.account_creation_failed',
  'stripe.connect.no_account',
  'booking.invalid_status',
  'booking.concurrent_update',
  'organizer.fetch_failed',
  'market.cannot_publish_without_hours',
  'profile.not_found',
  'skyltfonstret.already_subscribed',
  'skyltfonstret.no_subscription',
  'skyltfonstret.config_missing',
  'geocode.not_found',
  'auth.required',
  'auth.forbidden',
  'auth.lookup_failed',
  'input.invalid',
  'unknown',
])

export type AppError = {
  code: ErrorCode
  detail?: Record<string, unknown>
}

/**
 * Typed params per ErrorCode.
 *
 * Today no codes use template placeholders, so the map is empty.
 * Add entries here as templated catalog entries arrive, e.g.:
 *   'booking.date.conflict': { date: string }
 *
 * Codes NOT listed here accept Record<string, string | number> | undefined
 * (the historic loose signature is preserved via the conditional type).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ErrorParams = {
  // Empty today — no codes template params. Grows as templated catalog entries arrive.
}

/**
 * Resolve the expected params type for a given ErrorCode.
 * Codes in ErrorParams are tightly typed; all others accept any plain record.
 */
export type ParamsFor<C extends ErrorCode> =
  C extends keyof ErrorParams ? ErrorParams[C] : Record<string, string | number> | undefined

/**
 * Construct an AppError. Detail is optional and should be a plain object
 * of structured data that message templates may interpolate.
 */
export function appError<C extends ErrorCode>(code: C, detail?: ParamsFor<C>): AppError {
  return detail === undefined ? { code } : { code, detail: detail as Record<string, unknown> }
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
 * Return a Swedish user-facing message for an ErrorCode or AppError.
 *
 * Two call forms are supported:
 *   messageFor(code, params?, locale?)   — preferred in domain / edge code
 *   messageFor(appError)                 — convenience overload for UI code
 *
 * Falls back to the 'unknown' message if `code` is not in the catalog at
 * runtime (defensive against stale wire data that bypasses the type system).
 *
 * Performance: pure synchronous map lookup + string.replace. No async, no
 * regex compilation per call.
 */
export function messageFor(err: AppError): string
export function messageFor(
  code: ErrorCode,
  params?: Record<string, string | number>,
  _locale?: 'sv',
): string
export function messageFor(
  codeOrErr: ErrorCode | AppError,
  params?: Record<string, string | number>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale?: 'sv',
): string {
  if (typeof codeOrErr === 'object') {
    // AppError overload — delegate to code form, ignoring detail for now
    // (detail is untyped blob; params are string|number map for interpolation)
    return messageFor(codeOrErr.code)
  }
  const template = MESSAGES_SV[codeOrErr] ?? MESSAGES_SV['unknown']
  return interpolate(template, params)
}
