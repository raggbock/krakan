import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import {
  BlockSaleStandConfirmInput,
  BlockSaleStandConfirmOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-confirm.ts'
import { verifyEditToken } from '../_shared/block-sale-tokens.ts'
import { blockSaleNewApplicationEmail } from '../_shared/email-templates/block-sale-new-application.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { z } from 'zod'

export type HandleBlockSaleStandConfirmDeps = {
  admin: SupabaseClient
  origin: string
  input: z.infer<typeof BlockSaleStandConfirmInput>
  resendApiKey: string
  verifyToken?: typeof verifyEditToken
  sendMail?: typeof sendEmail
  fetchImpl?: typeof fetch
}

export async function handleBlockSaleStandConfirm(
  deps: HandleBlockSaleStandConfirmDeps,
): Promise<{ ok: true; standId: string }> {
  const {
    admin,
    origin,
    input,
    resendApiKey,
    verifyToken = verifyEditToken,
    sendMail = sendEmail,
    fetchImpl,
  } = deps

  const payload = await verifyToken(input.token)
  if (!payload) throw new HttpError(400, 'invalid_token')

  const { data: stand } = await admin
    .from('block_sale_stands')
    .select('id, status, applicant_name, block_sale_id')
    .eq('id', payload.standId)
    .maybeSingle()

  if (!stand) throw new HttpError(404, 'not_found')

  // Idempotent — already confirmed or approved
  if (stand.status === 'confirmed' || stand.status === 'approved') {
    return { ok: true as const, standId: stand.id }
  }

  if (stand.status === 'rejected') throw new HttpError(400, 'rejected')

  await admin
    .from('block_sale_stands')
    .update({
      status: 'confirmed',
      email_confirmed_at: new Date().toISOString(),
    })
    .eq('id', stand.id)

  // Fetch parent block_sale separately — avoids PostgREST embedding ambiguity
  // where !inner on a many-to-one may return an array instead of a plain object
  // depending on the client version.
  const { data: blockSale } = await admin
    .from('block_sales')
    .select('id, name, slug, organizer_id')
    .eq('id', stand.block_sale_id)
    .maybeSingle()

  if (!blockSale) throw new HttpError(404, 'block_sale_not_found')
  const { data: authData } = await admin.auth.admin.getUserById(blockSale.organizer_id)
  const organizerEmail = authData?.user?.email
  if (organizerEmail) {
    const tpl = blockSaleNewApplicationEmail({
      eventName: blockSale.name,
      applicantName: stand.applicant_name,
      adminUrl: `${origin}/kvartersloppis/${blockSale.slug}/admin`,
    })
    await sendMail({
      to: organizerEmail,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
      fetchImpl,
    })
  }

  return { ok: true as const, standId: stand.id }
}

definePublicEndpoint({
  name: 'block-sale-stand-confirm',
  input: BlockSaleStandConfirmInput,
  output: BlockSaleStandConfirmOutput,
  handler: async ({ admin, origin }, input) => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    return handleBlockSaleStandConfirm({ admin, origin, input, resendApiKey })
  },
})
