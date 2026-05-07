/**
 * Logger port — abstracts structured log emission.
 *
 * Implementations may call console.warn / console.error, forward to a
 * telemetry backend, or no-op in tests.
 */
export interface Logger {
  info(msg: string, context?: Record<string, unknown>): void
  warn(msg: string, context?: Record<string, unknown>): void
  error(msg: string, context?: Record<string, unknown>): void
}
