import { definePublicEndpoint } from '../_shared/public-endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { routeSavedAnonEmail } from '../_shared/email-templates/route-saved-anon.ts'
import {
  RouteCreateAnonInput,
  RouteCreateAnonOutput,
} from '@fyndstigen/shared/contracts/route-create-anon.ts'

/**
 * Spam guard: cap anon route saves per email per day. Routes are tied to a
 * user account so a spammer can't pollute public data — but they could waste
 * DB rows and Resend quota.
 */
const MAX_ANON_SAVES_PER_EMAIL_24H = 5

definePublicEndpoint({
  name: 'route-create-anon',
  input: RouteCreateAnonInput,
  output: RouteCreateAnonOutput,
  handler: async ({ admin, origin }, input) => {
    // Honeypot — bots auto-fill the hidden 'website' field; humans don't.
    if (input.website && input.website.length > 0) {
      throw new HttpError(400, 'honeypot')
    }

    const email = input.email.toLowerCase()

    // Spam guard: count routes created via this email in the last 24h.
    // We check by looking at the auth user's routes if they exist, or
    // count by looking up the user first.
    const { data: existing, error: lookupErr } = await admin
      .from('auth_user_email_view')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (lookupErr) throw new Error(lookupErr.message)

    if (existing?.id) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count: recentRoutes, error: countErr } = await admin
        .from('routes')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', existing.id)
        .gte('created_at', since)
      if (countErr) throw new Error(countErr.message)
      if ((recentRoutes ?? 0) >= MAX_ANON_SAVES_PER_EMAIL_24H) {
        throw new HttpError(429, 'too_many_saves')
      }
    }

    // Resolve auth user — create if missing. email_confirm: true so the
    // magic link works as a one-click sign-in.
    let userId = existing?.id as string | undefined
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createErr) throw new Error(createErr.message)
      userId = created.user.id
    }

    // Insert the route
    const { data: insertedRoute, error: routeErr } = await admin
      .from('routes')
      .insert({
        name: input.name,
        created_by: userId,
        planned_date: input.plannedDate ?? null,
        start_latitude: input.startLatitude ?? null,
        start_longitude: input.startLongitude ?? null,
      })
      .select('id')
      .single()
    if (routeErr) throw new Error(routeErr.message)
    const routeId = insertedRoute.id as string

    // Insert route stops
    if (input.marketIds.length > 0) {
      const { error: stopsErr } = await admin
        .from('route_stops')
        .insert(
          input.marketIds.map((fleaMarketId, i) => ({
            route_id: routeId,
            flea_market_id: fleaMarketId,
            sort_order: i,
          })),
        )
      if (stopsErr) {
        // Best-effort cleanup so we don't leave a route with no stops.
        await admin.from('routes').delete().eq('id', routeId)
        throw new Error(stopsErr.message)
      }
    }

    // Generate magic link — redirects to the route page so they see their
    // saved route immediately after clicking.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/rundor/${routeId}` },
    })
    if (linkErr) throw new Error(linkErr.message)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new HttpError(500, 'RESEND_API_KEY missing')
    const actionLink = linkData.properties?.action_link
    if (!actionLink) throw new HttpError(500, 'magic_link_missing')

    const { html, text } = routeSavedAnonEmail({
      magicLink: actionLink,
      routeName: input.name,
      stopCount: input.marketIds.length,
    })
    await sendEmail({
      to: email,
      subject: `Din loppisrunda "${input.name}" är sparad på Fyndstigen`,
      html,
      text,
      from: DEFAULT_FROM,
      apiKey: resendApiKey,
    })

    return { ok: true as const, routeId }
  },
})
