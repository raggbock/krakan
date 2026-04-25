import { z } from 'zod'

/**
 * Skyltfönstret = the organizer's premium subscription. The two edge functions
 * (skyltfonstret-checkout, skyltfonstret-portal) both take no body and respond
 * with a Stripe-hosted URL the client redirects to.
 */

const UrlOutput = z.object({ url: z.string().url() })

export const SkyltfonstretCheckoutInput = z.object({})
export const SkyltfonstretCheckoutOutput = UrlOutput
export type SkyltfonstretCheckoutInput = z.infer<typeof SkyltfonstretCheckoutInput>
export type SkyltfonstretCheckoutOutput = z.infer<typeof SkyltfonstretCheckoutOutput>

export const SkyltfonstretPortalInput = z.object({})
export const SkyltfonstretPortalOutput = UrlOutput
export type SkyltfonstretPortalInput = z.infer<typeof SkyltfonstretPortalInput>
export type SkyltfonstretPortalOutput = z.infer<typeof SkyltfonstretPortalOutput>
