import { z } from 'zod'
import type { EdgeClient } from './edge'
import {
  BookingCreateInput,
  BookingCreateOutput,
} from '../contracts/booking-create'

/**
 * Registry of typed edge endpoints.
 *
 * Each entry binds an edge-function name to its input/output Zod contracts.
 * Adding a new endpoint is a one-liner: import the contracts and append an
 * entry here.
 */
const ENDPOINTS = {
  bookingCreate: {
    name: 'booking-create',
    input: BookingCreateInput,
    output: BookingCreateOutput,
  },
} as const

type EndpointRegistry = typeof ENDPOINTS

type EndpointFn<K extends keyof EndpointRegistry> = (
  input: z.input<EndpointRegistry[K]['input']>,
) => Promise<z.infer<EndpointRegistry[K]['output']>>

export type EndpointsApi = {
  [K in keyof EndpointRegistry]: EndpointFn<K>
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
  for (const key of Object.keys(ENDPOINTS) as Array<keyof EndpointRegistry>) {
    const cfg = ENDPOINTS[key]
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
