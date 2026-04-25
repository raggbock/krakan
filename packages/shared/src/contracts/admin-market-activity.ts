import { z } from 'zod'

/**
 * admin-market-activity — last N admin_actions targeting a single market.
 * Used by the activity-history section in the admin edit drawer.
 */

export const AdminMarketActivityInput = z.object({
  marketId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional(),
})

export const AdminActivityRow = z.object({
  id: z.string(),
  action: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  adminEmail: z.string().nullable(),
})

export const AdminMarketActivityOutput = z.object({
  rows: z.array(AdminActivityRow),
})

export type AdminActivityRow = z.infer<typeof AdminActivityRow>
export type AdminMarketActivityOutput = z.infer<typeof AdminMarketActivityOutput>
