import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminRevokeInput,
  AdminRevokeOutput,
} from '@fyndstigen/shared/contracts/admin-revoke.ts'

defineEndpoint({
  name: 'admin-revoke',
  input: AdminRevokeInput,
  output: AdminRevokeOutput,
  handler: async ({ user, admin }, { userId }) => {
    const { data: isAdmin } = await admin.rpc('is_admin', { uid: user.id })
    if (!isAdmin) throw new HttpError(403, 'not_admin')

    const { count, error: countErr } = await admin
      .from('admin_users')
      .select('user_id', { count: 'exact', head: true })
      .is('revoked_at', null)
    if (countErr) throw new Error(countErr.message)
    if ((count ?? 0) <= 1) throw new HttpError(409, 'cannot_revoke_last_admin')

    const { error } = await admin
      .from('admin_users')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)
    if (error) throw new Error(error.message)

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'admin.revoked',
      target_type: 'admin_user',
      target_id: userId,
    })

    return { ok: true as const }
  },
})
