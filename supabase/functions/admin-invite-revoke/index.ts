import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminInviteRevokeInput,
  AdminInviteRevokeOutput,
} from '@fyndstigen/shared/contracts/admin-invite-revoke.ts'

defineEndpoint({
  name: 'admin-invite-revoke',
  input: AdminInviteRevokeInput,
  output: AdminInviteRevokeOutput,
  handler: async ({ user, admin }, { inviteId }) => {
    const { data: isAdmin } = await admin.rpc('is_admin', { uid: user.id })
    if (!isAdmin) throw new HttpError(403, 'not_admin')

    const { error } = await admin
      .from('admin_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('accepted_at', null)
    if (error) throw new Error(error.message)

    await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'admin.invite.revoked',
      target_type: 'admin_invite',
      target_id: inviteId,
    })

    return { ok: true as const }
  },
})
