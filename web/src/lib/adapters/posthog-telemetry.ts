import type { PostHog } from 'posthog-js'
import type { Telemetry, TelemetryEvent } from '@fyndstigen/shared'

/**
 * PostHog adapter for the Telemetry port.
 *
 * Wraps the posthog instance from `usePostHog()`. Silently no-ops when
 * posthog is null/undefined (e.g. cookie consent not granted).
 */
export function createPostHogTelemetry(posthog: PostHog | null | undefined): Telemetry {
  return {
    capture(event: TelemetryEvent): void {
      posthog?.capture(event.name, event.properties)
    },
  }
}
