import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminMarketActivityInput,
  AdminMarketActivityOutput,
} from '@fyndstigen/shared/contracts/admin-market-activity.ts'

defineEndpoint({
  name: 'admin-market-activity',
  input: AdminMarketActivityInput,
  output: AdminMarketActivityOutput,
  handler: async ({ user, admin }, { marketId, limit }) => {
    const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: user.id })
    if (rpcErr) throw new Error(rpcErr.message)
    if (!isAdminResult) throw new HttpError(403, 'not_admin')

    // Pull both per-market actions and any batch actions whose payload references
    // the market — admin-takeover-send logs as a batch but keeps per-market detail
    // in payload.results, so a strict target_id filter would miss those.
    const { data: actions, error: actErr } = await admin
      .from('admin_actions')
      .select('id, admin_user_id, action, target_type, target_id, payload, created_at')
      .or(`target_id.eq.${marketId},payload->>marketId.eq.${marketId}`)
      .order('created_at', { ascending: false })
      .limit(limit ?? 30)
    if (actErr) throw new Error(actErr.message)

    if (!actions || actions.length === 0) return { rows: [] }

    // Resolve admin emails via the existing RPC (rls-safe, returns id+email).
    const userIds = Array.from(new Set(actions.map((a) => a.admin_user_id as string)))
    const { data: emails, error: emailErr } = await admin.rpc('admin_user_emails', { user_ids: userIds })
    if (emailErr) console.error('[admin-market-activity] email resolve failed:', emailErr.message)
    const emailById = new Map<string, string>()
    for (const row of (emails ?? []) as Array<{ id: string; email: string }>) {
      emailById.set(row.id, row.email)
    }

    return {
      rows: actions.map((a) => ({
        id: a.id as string,
        action: a.action as string,
        payload: (a.payload as Record<string, unknown>) ?? {},
        createdAt: a.created_at as string,
        adminEmail: emailById.get(a.admin_user_id as string) ?? null,
      })),
    }
  },
})
