import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { canTransitionStandStatus } from '@fyndstigen/shared/block-sale.ts'
import {
  BlockSaleDecideInput,
  BlockSaleDecideOutput,
} from '@fyndstigen/shared/contracts/block-sale-decide.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { blockSaleApprovedEmail } from '../_shared/email-templates/block-sale-approved.ts'
import { blockSaleRejectedEmail } from '../_shared/email-templates/block-sale-rejected.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { z } from 'zod'

export type HandleBlockSaleDecideDeps = {
  admin: SupabaseClient
  userId: string
  origin: string
  input: z.infer<typeof BlockSaleDecideInput>
  resendApiKey: string
  sendMail?: typeof sendEmail
  fetchImpl?: typeof fetch
}

export async function handleBlockSaleDecide(
  deps: HandleBlockSaleDecideDeps,
): Promise<{ ok: true; decided: number }> {
  const {
    admin,
    userId,
    origin,
    input,
    resendApiKey,
    sendMail = sendEmail,
    fetchImpl,
  } = deps

  const { data: bs } = await admin
    .from('block_sales').select('id, name, slug, organizer_id')
    .eq('id', input.blockSaleId).maybeSingle()
  if (!bs) throw new HttpError(404, 'not_found')
  if (bs.organizer_id !== userId) throw new HttpError(403, 'forbidden')

  const targetStatus = input.decision === 'approve' ? 'approved' : 'rejected'
  const { data: stands } = await admin
    .from('block_sale_stands')
    .select('id, status, applicant_email, applicant_name, edit_token')
    .in('id', input.standIds).eq('block_sale_id', bs.id)

  let decided = 0
  for (const s of stands ?? []) {
    if (!canTransitionStandStatus(s.status, targetStatus)) continue
    await admin.from('block_sale_stands').update({
      status: targetStatus,
      decided_at: new Date().toISOString(),
    }).eq('id', s.id)
    decided++

    const editUrl = `${origin}/kvartersloppis/${bs.slug}/min-ansokan?token=${encodeURIComponent(s.edit_token)}`
    const tpl = input.decision === 'approve'
      ? blockSaleApprovedEmail({ eventName: bs.name, eventUrl: `${origin}/kvartersloppis/${bs.slug}`, editUrl })
      : blockSaleRejectedEmail({ eventName: bs.name, reason: input.reason })
    await sendMail({
      to: s.applicant_email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
      fetchImpl,
    })
  }

  return { ok: true as const, decided }
}

defineEndpoint({
  name: 'block-sale-decide',
  input: BlockSaleDecideInput,
  output: BlockSaleDecideOutput,
  handler: async ({ admin, user, origin }, input) => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    return handleBlockSaleDecide({ admin, userId: user.id, origin, input, resendApiKey })
  },
})
