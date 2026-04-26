import { defineAdminEndpoint } from '../_shared/endpoint.ts'
import {
  AdminInviteRevokeInput,
  AdminInviteRevokeOutput,
} from '@fyndstigen/shared/contracts/admin-invite-revoke.ts'

defineAdminEndpoint({
  name: 'admin-invite-revoke',
  input: AdminInviteRevokeInput,
  output: AdminInviteRevokeOutput,
  handler: async ({ user, admin }, { inviteId }) => {
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
