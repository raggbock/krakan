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
import {
  StripePaymentCancelInput,
  StripePaymentCancelOutput,
} from '../contracts/stripe-payment-cancel'
import {
  StripeConnectCreateInput,
  StripeConnectCreateOutput,
} from '../contracts/stripe-connect-create'
import {
  StripeConnectRefreshInput,
  StripeConnectRefreshOutput,
} from '../contracts/stripe-connect-refresh'
import {
  StripeConnectStatusInput,
  StripeConnectStatusOutput,
} from '../contracts/stripe-connect-status'
import {
  OrganizerStatsInput,
  OrganizerStatsOutput,
} from '../contracts/organizer-stats'
import {
  AdminBusinessImportInput,
  AdminBusinessImportOutput,
} from '../contracts/admin-business-import'
import {
  AdminInviteCreateInput,
  AdminInviteCreateOutput,
} from '../contracts/admin-invite-create'
import {
  AdminInviteAcceptInput,
  AdminInviteAcceptOutput,
} from '../contracts/admin-invite-accept'
import {
  AdminInviteRevokeInput,
  AdminInviteRevokeOutput,
} from '../contracts/admin-invite-revoke'
import {
  AdminRevokeInput,
  AdminRevokeOutput,
} from '../contracts/admin-revoke'
import {
  AdminTakeoverPendingInput,
  AdminTakeoverPendingOutput,
  AdminTakeoverSendInput,
  AdminTakeoverSendOutput,
} from '../contracts/admin-takeover-send'
import {
  SkyltfonstretCheckoutInput,
  SkyltfonstretCheckoutOutput,
  SkyltfonstretPortalInput,
  SkyltfonstretPortalOutput,
} from '../contracts/skyltfonstret'

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
  'stripe.payment.cancel': defineEndpointDef({
    path: 'stripe-payment-cancel',
    request: StripePaymentCancelInput,
    response: StripePaymentCancelOutput,
  }),
  'stripe.connect.create': defineEndpointDef({
    path: 'stripe-connect-create',
    request: StripeConnectCreateInput,
    response: StripeConnectCreateOutput,
  }),
  'stripe.connect.refresh': defineEndpointDef({
    path: 'stripe-connect-refresh',
    request: StripeConnectRefreshInput,
    response: StripeConnectRefreshOutput,
  }),
  'stripe.connect.status': defineEndpointDef({
    path: 'stripe-connect-status',
    request: StripeConnectStatusInput,
    response: StripeConnectStatusOutput,
  }),
  'organizer.stats': defineEndpointDef({
    path: 'organizer-stats',
    request: OrganizerStatsInput,
    response: OrganizerStatsOutput,
  }),
  'admin.business.import': defineEndpointDef({
    path: 'admin-business-import',
    request: AdminBusinessImportInput,
    response: AdminBusinessImportOutput,
  }),
  'admin.invite.create': defineEndpointDef({
    path: 'admin-invite-create',
    request: AdminInviteCreateInput,
    response: AdminInviteCreateOutput,
  }),
  'admin.invite.accept': defineEndpointDef({
    path: 'admin-invite-accept',
    request: AdminInviteAcceptInput,
    response: AdminInviteAcceptOutput,
  }),
  'admin.invite.revoke': defineEndpointDef({
    path: 'admin-invite-revoke',
    request: AdminInviteRevokeInput,
    response: AdminInviteRevokeOutput,
  }),
  'admin.revoke': defineEndpointDef({
    path: 'admin-revoke',
    request: AdminRevokeInput,
    response: AdminRevokeOutput,
  }),
  'admin.takeover.pending': defineEndpointDef({
    path: 'admin-takeover-pending',
    request: AdminTakeoverPendingInput,
    response: AdminTakeoverPendingOutput,
  }),
  'admin.takeover.send': defineEndpointDef({
    path: 'admin-takeover-send',
    request: AdminTakeoverSendInput,
    response: AdminTakeoverSendOutput,
  }),
  // takeover.{info,start,verify} are public (verify_jwt:false) — createEdgeClient
  // attaches a Bearer token unconditionally, so they can't go through this
  // registry yet. Contracts live in @fyndstigen/shared/contracts/takeover and
  // callers use invokeEdgeFn() until the registry grows a public-endpoint mode.
  'skyltfonstret.checkout': defineEndpointDef({
    path: 'skyltfonstret-checkout',
    request: SkyltfonstretCheckoutInput,
    response: SkyltfonstretCheckoutOutput,
  }),
  'skyltfonstret.portal': defineEndpointDef({
    path: 'skyltfonstret-portal',
    request: SkyltfonstretPortalInput,
    response: SkyltfonstretPortalOutput,
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
