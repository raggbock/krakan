import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { marketCreatedEmail } from '../_shared/email-templates/market-created.ts'
import { pickUniqueSlug } from '../_shared/slug.ts'
import {
  PublicMarketCreateInput,
  PublicMarketCreateOutput,
} from '@fyndstigen/shared/contracts/public-market-create.ts'

/**
 * Spam guard: cap unpublished markets per email per day. Drafts are
 * already invisible and noindex'd, so a spammer can't actually pollute
 * the public catalog — but they could waste DB rows and Resend quota.
 * 5 per 24h is comfortably above any real-world organizer (who'd create
 * 1, maybe 2) and well below what an automated abuser would want.
 */
const MAX_DRAFTS_PER_EMAIL_24H = 5

definePublicEndpoint({
  name: 'public-market-create',
  input: PublicMarketCreateInput,
  output: PublicMarketCreateOutput,
  handler: async ({ admin, origin }, input) => {
    const email = input.email.toLowerCase()

    // Validate date is today or in the future. Done after Zod regex check
    // so we know the string parses; here we enforce the semantic rule.
    const dateMs = Date.parse(`${input.date}T00:00:00Z`)
    const todayMs = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
    if (Number.isNaN(dateMs) || dateMs < todayMs) {
      throw new HttpError(400, 'date_in_past')
    }

    // Spam guard: count drafts created by this email in the last 24h.
    // Uses contact_email rather than auth user (the user may not exist
    // yet, and we need to count BEFORE we create them).
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: recentDrafts, error: countErr } = await admin
      .from('flea_markets')
      .select('id', { count: 'exact', head: true })
      .eq('contact_email', email)
      .is('published_at', null)
      .eq('is_deleted', false)
      .gte('created_at', since)
    if (countErr) throw new Error(countErr.message)
    if ((recentDrafts ?? 0) >= MAX_DRAFTS_PER_EMAIL_24H) {
      throw new HttpError(429, 'too_many_drafts')
    }

    // Resolve auth user — create if missing. email_confirm: true so the
    // magic link below works as a one-click sign-in. The user is NOT
    // auto-confirmed in the social/regulatory sense — they still need to
    // click the link before they can edit.
    const { data: existing, error: lookupErr } = await admin
      .from('auth_user_email_view')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (lookupErr) throw new Error(lookupErr.message)
    let userId = existing?.id as string | undefined
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createErr) throw new Error(createErr.message)
      userId = created.user.id
    }

    // Build a unique slug — checks both live slugs and historic slug claims
    // so we never create a market whose slug would shadow a redirect.
    // No excludeMarketId on creation (the market doesn't exist yet).
    const slug = await pickUniqueSlug(admin, input.name, input.city)

    const { data: inserted, error: insertErr } = await admin
      .from('flea_markets')
      .insert({
        name: input.name,
        slug,
        city: input.city,
        street: input.street?.trim() || null,
        country: 'Sweden',
        is_permanent: false,
        organizer_id: userId,
        is_system_owned: false,
        contact_email: email,
        // published_at intentionally null — owner publishes manually
      })
      .select('id')
      .single()
    if (insertErr) throw new Error(insertErr.message)
    const marketId = inserted.id as string

    // Insert the date-anchored opening hour rule. is_market_visible's
    // temporary-market branch keys off this row (anchor_date >= today)
    // — without it, even a published draft stays invisible.
    const { error: ohrErr } = await admin
      .from('opening_hour_rules')
      .insert({
        flea_market_id: marketId,
        type: 'date',
        anchor_date: input.date,
        open_time: input.openTime,
        close_time: input.closeTime,
      })
    if (ohrErr) {
      // Best-effort cleanup so we don't leave a market with no hours.
      await admin.from('flea_markets').delete().eq('id', marketId)
      throw new Error(ohrErr.message)
    }

    // Generate magic link — redirects straight to the public page so the
    // owner sees their draft (with the "opublicerat utkast"-banner that
    // links to /fleamarkets/[id]/edit). Cleaner UX than dropping them
    // straight into the form.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/loppis/${slug}` },
    })
    if (linkErr) throw new Error(linkErr.message)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    const actionLink = linkData.properties?.action_link
    if (!actionLink) throw new HttpError(500, 'magic_link_missing')

    const { html, text } = marketCreatedEmail({
      magicLink: actionLink,
      marketName: input.name,
    })
    await sendEmail({
      to: email,
      subject: `Slutför ${input.name} på Fyndstigen`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })

    return { ok: true as const, slug }
  },
})
