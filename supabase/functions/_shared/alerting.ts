/**
 * AlertSink — port for surfacing operational problems beyond Supabase logs.
 *
 * Today: contract violations and uncaught exceptions go to `console.error`
 * and live only in Supabase Edge logs (where nobody is paged). This port
 * lets a real alerting backend (Sentry, Slack webhook, log-drain) be wired
 * in by swapping the singleton in `getAlertSink()` — no per-endpoint change.
 *
 * Two event types:
 *   - `captureViolation`: zod output-contract failure. Non-fatal in 'warn'
 *     mode; the response still goes out to the client. We want eyes on
 *     these because they indicate schema drift between the edge function
 *     and its callers.
 *   - `captureException`: an unhandled throw inside an endpoint handler.
 *     The user already got a 4xx/5xx; this is the operator-side signal.
 *
 * Adapters: today only the console sink exists. Add Sentry / Slack
 * adapters next to this file and switch `getAlertSink()` to use them.
 *
 * Tracked: #113.
 */

export type AlertContext = {
  /** Endpoint name (e.g. 'booking-create') */
  endpoint?: string
  /** Authenticated user id, if available */
  userId?: string
  /** Anything else the caller wants to attach for debugging */
  extra?: Record<string, unknown>
}

export interface AlertSink {
  captureViolation(name: string, issues: unknown, context?: AlertContext): void
  captureException(err: unknown, context?: AlertContext): void
}

/**
 * Default sink — emits structured JSON to stderr so Supabase Edge logs
 * keep their existing shape. Same behavior as before this port existed.
 */
export function createConsoleSink(): AlertSink {
  return {
    captureViolation(name, issues, context) {
      const payload = {
        kind: 'output_contract_violation',
        endpoint: name,
        issues,
        ...context,
      }
      console.error(JSON.stringify(payload))
    },
    captureException(err, context) {
      const payload = {
        kind: 'edge_exception',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ...context,
      }
      console.error(JSON.stringify(payload))
    },
  }
}

// ---------------------------------------------------------------------------
// Singleton — resolved lazily so adapter selection can read env vars at
// first-use time. Tests can inject a sink via `setAlertSink(fakeSink)`.
//
// Activation flow:
//   1. First call to getAlertSink() reads SENTRY_DSN.
//   2. If set, lazy-imports the Sentry adapter and uses it.
//   3. If unset (or import fails), falls back to the console sink.
//
// Importing the Sentry adapter is async; getAlertSink() returns the
// console sink synchronously on first call and upgrades to Sentry once
// the init promise resolves. Concurrent callers in that small window
// emit through the console — acceptable since these are rare events.
// ---------------------------------------------------------------------------

let _sink: AlertSink | null = null
let _sentryInitStarted = false

export function getAlertSink(): AlertSink {
  if (_sink) return _sink

  _sink = createConsoleSink()

  if (!_sentryInitStarted) {
    _sentryInitStarted = true
    const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env
    const dsn = env?.get('SENTRY_DSN')
    if (dsn) {
      // Lazy import keeps the SDK out of the bundle when SENTRY_DSN is unset.
      import('./alerting-sentry.ts')
        .then(({ createSentrySink }) =>
          createSentrySink(dsn, {
            environment: env?.get('SUPABASE_ENVIRONMENT') ?? 'production',
          }),
        )
        .then((sentrySink) => {
          if (sentrySink) _sink = sentrySink
        })
        .catch((err) => {
          console.error(JSON.stringify({ kind: 'sentry_init_failed', message: String(err) }))
        })
    }
  }

  return _sink
}

/** Test seam. Reset between tests. */
export function setAlertSink(sink: AlertSink | null): void {
  _sink = sink
  _sentryInitStarted = sink !== null
}
