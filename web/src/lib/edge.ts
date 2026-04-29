import { createEdgeClient, createEndpointInvokers } from '@fyndstigen/shared'
import { supabase } from './supabase'

/**
 * Raw EdgeClient — use when you need `edge.invoke` / `edge.invokePublic` directly.
 * Prefer `endpoints[...]` for typed, contract-validated calls to named edge functions.
 */
export const edge = createEdgeClient(supabase)

/**
 * Typed invokers for the flat ENDPOINTS registry.
 *
 * Usage:
 *   import { endpoints } from '@/lib/edge'
 *   const res = await endpoints['stripe.payment.capture'].invoke({ bookingId })
 */
export const endpoints = createEndpointInvokers(edge)
