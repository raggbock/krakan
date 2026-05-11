/**
 * Sentry adapter for AlertSink.
 *
 * Activation: set `SENTRY_DSN` in Supabase Edge env config. Once present,
 * `getAlertSink()` in `alerting.ts` will return this sink instead of the
 * console default.
 *
 * Uses Sentry's lightweight JS SDK via esm.sh, which is Deno-compatible.
 * The SDK is loaded lazily so functions without a DSN don't pay the
 * import cost.
 *
 * Captures go to the configured environment. Sample rate is fixed at
 * 1.0 — alerts here are rare (contract violations + unhandled throws)
 * so we want every one.
 *
 * Sentry MCP: with the MCP server connected, queries can confirm events
 * land (see `find_projects` / `search_issues`). Disable by unsetting the
 * env var; the sink falls back to console automatically.
 */

import type { AlertSink, AlertContext } from './alerting.ts'

// Type-only import. The runtime import happens inside `createSentrySink`
// so functions without a DSN don't bundle the SDK at module-load time.
type SentryLike = {
  init(opts: { dsn: string; environment?: string; tracesSampleRate?: number }): void
  captureException(err: unknown, ctx?: { extra?: Record<string, unknown>; user?: { id?: string } }): string
  captureMessage(
    msg: string,
    ctx?: {
      level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'
      extra?: Record<string, unknown>
      user?: { id?: string }
    },
  ): string
}

/**
 * Build a Sentry-backed AlertSink. Returns `null` when the DSN is unset
 * so the caller can fall back to the console sink without a try/catch.
 *
 * Wire-up (in a future PR, once DSN is configured):
 *
 *   import { createSentrySink } from './alerting-sentry.ts'
 *   import { setAlertSink } from './alerting.ts'
 *
 *   const dsn = Deno.env.get('SENTRY_DSN')
 *   if (dsn) setAlertSink(await createSentrySink(dsn))
 */
export async function createSentrySink(
  dsn: string,
  options?: { environment?: string },
): Promise<AlertSink | null> {
  if (!dsn) return null

  // Pinned URL; bump deliberately. The Deno-targeted bundle of
  // @sentry/browser is currently the cleanest path for edge functions.
  const Sentry: SentryLike = (await import('https://esm.sh/@sentry/browser@8?target=deno')) as unknown as SentryLike

  Sentry.init({
    dsn,
    environment: options?.environment ?? 'production',
    tracesSampleRate: 1.0,
  })

  return {
    captureViolation(name, issues, context) {
      Sentry.captureMessage(`[output_contract_violation] ${name}`, {
        level: 'error',
        user: context?.userId ? { id: context.userId } : undefined,
        extra: {
          endpoint: name,
          issues,
          ...(context?.extra ?? {}),
        },
      })
    },
    captureException(err, context) {
      Sentry.captureException(err, {
        user: context?.userId ? { id: context.userId } : undefined,
        extra: {
          endpoint: context?.endpoint,
          ...(context?.extra ?? {}),
        },
      })
    },
  }
}
