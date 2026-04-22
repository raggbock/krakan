import { z } from 'zod'
import type { EdgeClient } from './edge'
import {
  BookingCreateInput,
  BookingCreateOutput,
} from '../contracts/booking-create'
import {
  StripePaymentCaptureInput,
  StripePaymentCaptureOutput,
} from '../contracts/stripe-payment-capture'

// ---------------------------------------------------------------------------
// Registry definition helpers
// ---------------------------------------------------------------------------

type EndpointDef<I extends z.ZodTypeAny, O extends z.ZodTypeAny> = {
  /** Deno edge-function name used in supabase.functions.invoke */
  path: string
  request: I
  response: O
}

function defineEndpointDef<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(
  cfg: EndpointDef<I, O>,
): EndpointDef<I, O> {
  return cfg
}

// ---------------------------------------------------------------------------
// ENDPOINTS — flat key registry
//
// Each entry binds a logical name to its edge-function path and Zod
// request/response contracts. Adding a new endpoint is a one-liner.
// ---------------------------------------------------------------------------

export const ENDPOINTS = {
  'booking.create': defineEndpointDef({
    path: 'booking-create',
    request: BookingCreateInput,
    response: BookingCreateOutput,
  }),
  'stripe.payment.capture': defineEndpointDef({
    path: 'stripe-payment-capture',
    request: StripePaymentCaptureInput,
    response: StripePaymentCaptureOutput,
  }),
} as const

export type EndpointKey = keyof typeof ENDPOINTS

// ---------------------------------------------------------------------------
// Client invoker built around an EdgeClient
//
// Usage:
//   const invokers = createEndpointInvokers(edge)
//   const res = await invokers['stripe.payment.capture'].invoke({ bookingId })
// ---------------------------------------------------------------------------

type InvokerFor<K extends EndpointKey> = {
  invoke(
    input: z.input<(typeof ENDPOINTS)[K]['request']>,
  ): Promise<z.infer<(typeof ENDPOINTS)[K]['response']>>
}

export type EndpointInvokers = {
  [K in EndpointKey]: InvokerFor<K>
}

export function createEndpointInvokers(edge: EdgeClient): EndpointInvokers {
  const out = {} as EndpointInvokers
  for (const key of Object.keys(ENDPOINTS) as EndpointKey[]) {
    const def = ENDPOINTS[key]
    const invoker: InvokerFor<typeof key> = {
      async invoke(input: unknown) {
        const parsedInput = def.request.parse(input)
        const raw = await edge.invoke<unknown>(def.path, parsedInput)
        return def.response.parse(raw)
      },
    }
    ;(out as Record<string, unknown>)[key] = invoker
  }
  return out
}

// ---------------------------------------------------------------------------
// Legacy camelCase registry — kept for backward compat with booking-service
// and existing tests. Do NOT add new entries here; use ENDPOINTS above.
// ---------------------------------------------------------------------------

const LEGACY_ENDPOINTS = {
  bookingCreate: {
    name: 'booking-create',
    input: BookingCreateInput,
    output: BookingCreateOutput,
  },
} as const

type LegacyRegistry = typeof LEGACY_ENDPOINTS

type EndpointFn<K extends keyof LegacyRegistry> = (
  input: z.input<LegacyRegistry[K]['input']>,
) => Promise<z.infer<LegacyRegistry[K]['output']>>

export type EndpointsApi = {
  [K in keyof LegacyRegistry]: EndpointFn<K>
}

/**
 * Build the typed invoker object around an `EdgeClient`.
 *
 * Each method:
 *   1. Validates input client-side (fail fast, avoids a round-trip on obvious bugs).
 *   2. Calls `edge.invoke` with the registered edge-function name.
 *   3. Validates the response against the output contract.
 *
 * Validation failures throw a `ZodError` — callers higher up the stack
 * translate to user-facing Swedish messages via the AppError catalog.
 */
export function createEndpointsApi(edge: EdgeClient): EndpointsApi {
  const out = {} as EndpointsApi
  for (const key of Object.keys(LEGACY_ENDPOINTS) as Array<keyof LegacyRegistry>) {
    const cfg = LEGACY_ENDPOINTS[key]
    const fn = async (input: unknown) => {
      const parsedInput = cfg.input.parse(input)
      const raw = await edge.invoke<unknown>(cfg.name, parsedInput)
      return cfg.output.parse(raw)
    }
    // Cast is safe by construction — each key maps to its matching EndpointFn.
    ;(out as Record<string, unknown>)[key as string] = fn
  }
  return out
}
