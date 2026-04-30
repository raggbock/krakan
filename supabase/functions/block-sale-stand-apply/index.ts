import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import {
  BlockSaleStandApplyInput,
  BlockSaleStandApplyOutput,
} from '@fyndstigen/shared/contracts/block-sale-stand-apply.ts'
import { geocodeAddress } from '../_shared/geocode.ts'
import { blockSaleConfirmEmail } from '../_shared/email-templates/block-sale-confirm.ts'
import { blockSaleNewApplicationEmail } from '../_shared/email-templates/block-sale-new-application.ts'
import { signEditToken } from '../_shared/block-sale-tokens.ts'
import { getSupabaseClient } from '../_shared/auth.ts'
import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'
import type { z } from 'zod'

export type HandleBlockSaleStandApplyDeps = {
  admin: SupabaseClient
  user: User | null
  origin: string
  input: z.infer<typeof BlockSaleStandApplyInput>
  resendApiKey: string
  geocode?: typeof geocodeAddress
  sign?: typeof signEditToken
  sendMail?: typeof sendEmail
  fetchImpl?: typeof fetch
}

export async function handleBlockSaleStandApply(
  deps: HandleBlockSaleStandApplyDeps,
): Promise<{ ok: true; standId: string }> {
  const {
    admin,
    user,
    origin,
    input,
    resendApiKey,
    geocode = geocodeAddress,
    sign = signEditToken,
    sendMail = sendEmail,
    fetchImpl,
  } = deps

  // Honeypot — bots fill hidden `website` field
  if (input.website && input.website.length > 0) {
    throw new HttpError(400, 'honeypot')
  }

  // TODO: enforce IP rate-limit (5 requests/hour per IP).
  // Pending proper rate-limit store (Cloudflare KV or pg table).
  // Currently always allows to unblock the feature.

  // Verify block_sale exists and is published
  const { data: bs } = await admin
    .from('block_sales')
    .select('id, slug, organizer_id, name, end_date, published_at')
    .eq('id', input.blockSaleId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!bs || !bs.published_at) throw new HttpError(404, 'not_found')

  const geo = await geocode(`${input.street}, ${input.city}, Sweden`).catch(() => null)

  const standId = crypto.randomUUID()
  const editToken = await sign({ standId })

  const status = user ? 'confirmed' : 'pending'
  const row: Record<string, unknown> = {
    id: standId,
    block_sale_id: input.blockSaleId,
    user_id: user?.id ?? null,
    applicant_email: input.email.toLowerCase(),
    applicant_name: input.name,
    street: input.street,
    zip_code: input.zipCode ?? null,
    city: input.city,
    description: input.description,
    status,
    edit_token: editToken,
    email_confirmed_at: user ? new Date().toISOString() : null,
  }
  if (geo) row.location = `POINT(${geo.lng} ${geo.lat})`

  const { error } = await admin.from('block_sale_stands').insert(row)
  if (error) throw new Error(error.message)

  if (!user) {
    // Anonymous: send email-confirm link; organizer notified only after confirm
    const confirmUrl = `${origin}/api/block-sale-stand-confirm?token=${encodeURIComponent(editToken)}`
    const tpl = blockSaleConfirmEmail({ eventName: bs.name, confirmUrl })
    await sendMail({
      to: input.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
      fetchImpl,
    })
  } else {
    // Logged in: skip email-confirm; notify organizer immediately
    const { data: authData } = await admin.auth.admin.getUserById(bs.organizer_id)
    const organizerEmail = authData?.user?.email
    if (organizerEmail) {
      const tpl = blockSaleNewApplicationEmail({
        eventName: bs.name,
        applicantName: input.name,
        adminUrl: `${origin}/kvartersloppis/${bs.slug}/admin`,
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
  }

  return { ok: true as const, standId }
}

definePublicEndpoint({
  name: 'block-sale-stand-apply',
  input: BlockSaleStandApplyInput,
  output: BlockSaleStandApplyOutput,
  handler: async ({ admin, origin, req }, input) => {
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')

    // Optionally resolve the calling user — logged-in users skip email-confirm
    let user: import('https://esm.sh/@supabase/supabase-js@2').User | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      try {
        const client = getSupabaseClient(authHeader)
        const { data } = await client.auth.getUser()
        user = data.user ?? null
      } catch {
        // Invalid token → treat as anonymous
      }
    }

    return handleBlockSaleStandApply({ admin, user, origin, input, resendApiKey })
  },
})
