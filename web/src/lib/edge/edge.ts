/**
 * Edge client singletons for the web app.
 *
 * Two exports:
 *   - `edge`      — raw EdgeClient (use `edge.invoke` / `edge.invokePublic` when you need
 *                   direct control over the call; rare — prefer `endpoints` instead).
 *   - `endpoints` — typed invoker map for the flat ENDPOINTS registry in
 *                   @fyndstigen/shared/api/endpoints. Provides static types and Zod
 *                   contract validation for all registered functions.
 *
 * For functions NOT yet in the registry, use `invokeEdgeFn` from `./invoke.ts`.
 */

import { createEdgeClient, createEndpointInvokers } from '@fyndstigen/shared'
import { supabase } from '../supabase'

/**
 * Raw EdgeClient — use when you need `edge.invoke` / `edge.invokePublic` directly.
 * Prefer `endpoints[...]` for typed, contract-validated calls to named edge functions.
 */
export const edge = createEdgeClient(supabase)

/**
 * Typed invokers for the flat ENDPOINTS registry.
 *
 * Usage:
 *   import { endpoints } from '@/lib/edge/edge'
 *   const res = await endpoints['stripe.payment.capture'].invoke({ bookingId })
 */
export const endpoints = createEndpointInvokers(edge)
