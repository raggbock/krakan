/**
 * notification-digest edge function.
 *
 * Invoked by pg_cron daily at 06:00 Europe/Stockholm.
 * Finds users with pending email deliveries + email_digest_enabled=true,
 * builds a digest per user, sends via Resend, marks rows sent/failed.
 *
 * Pattern mirrors stripe-webhooks: pure reducer in reducer.ts, I/O here.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/auth.ts'
import { sendEmail, DEFAULT_FROM } from '../_shared/email.ts'
import { buildDigestCommands } from './reducer.ts'
import type { UserDigestInput, NotificationDeliveryRow } from './reducer.ts'

const BASE_URL = 'https://fyndstigen.se'

const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: 'info', msg, ...(ctx ?? {}) })),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...(ctx ?? {}) })),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: 'error', msg, ...(ctx ?? {}) })),
}

serve(async (req: Request) => {
  // pg_cron calls this with the service-role key in Authorization header.
  // We use the admin client directly — no user auth needed.
  const admin = getSupabaseAdmin()

  log.info('notification-digest: starting')

  try {
    // ------------------------------------------------------------------
    // 1. Find distinct user IDs with pending email deliveries (last 24h)
    // ------------------------------------------------------------------
    const { data: pendingUsers, error: pendingError } = await admin
      .from('notification_deliveries')
      .select('user_id')
      .eq('channel', 'email')
      .eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (pendingError) {
      log.error('Failed to query pending deliveries', { error: pendingError.message })
      return new Response(JSON.stringify({ error: pendingError.message }), { status: 500 })
    }

    const distinctUserIds = [...new Set((pendingUsers ?? []).map((r: { user_id: string }) => r.user_id))]

    if (distinctUserIds.length === 0) {
      log.info('notification-digest: no pending deliveries, exiting')
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    log.info('notification-digest: found users with pending deliveries', { count: distinctUserIds.length })

    // ------------------------------------------------------------------
    // 2. Load notification prefs — skip users with email_digest_enabled=false
    // ------------------------------------------------------------------
    const { data: prefsRows, error: prefsError } = await admin
      .from('user_notification_prefs')
      .select('user_id, email_digest_enabled, unsubscribe_token')
      .in('user_id', distinctUserIds)

    if (prefsError) {
      log.error('Failed to query notification prefs', { error: prefsError.message })
      return new Response(JSON.stringify({ error: prefsError.message }), { status: 500 })
    }

    const prefsMap = new Map(
      (prefsRows ?? []).map((p: { user_id: string; email_digest_enabled: boolean; unsubscribe_token: string }) => [
        p.user_id,
        p,
      ]),
    )

    const eligibleUserIds = distinctUserIds.filter((uid) => {
      const prefs = prefsMap.get(uid)
      // If no prefs row yet (user followed before auto-create trigger), default to true
      return !prefs || prefs.email_digest_enabled
    })

    if (eligibleUserIds.length === 0) {
      log.info('notification-digest: all users have digest disabled')
      return new Response(JSON.stringify({ sent: 0, skipped: distinctUserIds.length }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // 3. Fetch emails from auth.users via admin API
    // ------------------------------------------------------------------
    // Supabase admin.auth.admin.listUsers() is paginated; for now we fetch
    // in a single call (max 1000 per page — well above expected digest volume).
    const { data: { users: authUsers }, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (authError) {
      log.error('Failed to list auth users', { error: (authError as Error).message })
      return new Response(JSON.stringify({ error: (authError as Error).message }), { status: 500 })
    }

    const emailMap = new Map(
      authUsers
        .filter((u: { id: string; email?: string }) => u.email)
        .map((u: { id: string; email?: string }) => [u.id, u.email!]),
    )

    // ------------------------------------------------------------------
    // 4. Fetch pending deliveries with joined event + market/city data
    // ------------------------------------------------------------------
    const { data: deliveryRows, error: deliveryError } = await admin
      .from('notification_deliveries')
      .select(`
        id,
        user_id,
        event_id,
        reason,
        channel,
        status,
        created_at,
        notification_events (
          id,
          type,
          flea_market_id,
          city_slug,
          payload,
          occurred_at
        )
      `)
      .eq('channel', 'email')
      .eq('status', 'pending')
      .in('user_id', eligibleUserIds)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (deliveryError) {
      log.error('Failed to fetch delivery rows', { error: deliveryError.message })
      return new Response(JSON.stringify({ error: deliveryError.message }), { status: 500 })
    }

    // Group deliveries by user
    const deliveriesByUser = new Map<string, NotificationDeliveryRow[]>()
    for (const row of (deliveryRows ?? [])) {
      const event = (row as Record<string, unknown>).notification_events as Record<string, unknown> | null
      if (!event) continue

      const mapped: NotificationDeliveryRow = {
        id: row.id as string,
        userId: row.user_id as string,
        eventId: row.event_id as string,
        reason: row.reason as 'market' | 'city',
        channel: row.channel as 'inbox' | 'email',
        status: row.status as string,
        createdAt: row.created_at as string,
        eventType: event.type as NotificationDeliveryRow['eventType'],
        eventPayload: (event.payload ?? {}) as Record<string, unknown>,
        occurredAt: event.occurred_at as string,
        fleaMarketId: (event.flea_market_id as string | null) ?? null,
        citySlug: (event.city_slug as string | null) ?? null,
      }

      const existing = deliveriesByUser.get(row.user_id as string) ?? []
      existing.push(mapped)
      deliveriesByUser.set(row.user_id as string, existing)
    }

    // Build UserDigestInput array
    const usersInput: UserDigestInput[] = []
    for (const userId of eligibleUserIds) {
      const email = emailMap.get(userId)
      if (!email) {
        log.warn('No email found for user, skipping', { userId })
        continue
      }
      const prefs = prefsMap.get(userId)
      const unsubscribeToken = prefs?.unsubscribe_token ?? ''
      const deliveries = deliveriesByUser.get(userId) ?? []
      usersInput.push({ userId, email, unsubscribeToken, deliveries })
    }

    // ------------------------------------------------------------------
    // 5. Run pure reducer to get commands
    // ------------------------------------------------------------------
    const commands = buildDigestCommands(usersInput, BASE_URL)

    // ------------------------------------------------------------------
    // 6. Execute commands
    // ------------------------------------------------------------------
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
    let sentCount = 0
    let skippedCount = 0

    for (const cmd of commands) {
      if (cmd.type === 'skip_empty' || cmd.type === 'skip_no_prefs') {
        skippedCount++
        continue
      }

      // cmd.type === 'send_email'
      try {
        await sendEmail({
          to: cmd.to,
          subject: cmd.subject,
          html: cmd.html,
          text: cmd.text,
          from: DEFAULT_FROM,
          apiKey: resendApiKey,
        })

        // Mark deliveries as sent
        const { error: updateError } = await admin
          .from('notification_deliveries')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .in('id', cmd.deliveryIds)

        if (updateError) {
          log.warn('Failed to mark deliveries sent', { userId: cmd.userId, error: updateError.message })
        }

        sentCount++
        log.info('Digest sent', { userId: cmd.userId, to: cmd.to, deliveryCount: cmd.deliveryIds.length })
      } catch (err) {
        // Mark deliveries as failed — they will be retried on next cron tick
        const { error: failError } = await admin
          .from('notification_deliveries')
          .update({ status: 'failed' })
          .in('id', cmd.deliveryIds)

        if (failError) {
          log.warn('Failed to mark deliveries failed', { userId: cmd.userId, error: failError.message })
        }

        log.error('Failed to send digest email', {
          userId: cmd.userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    log.info('notification-digest: complete', { sent: sentCount, skipped: skippedCount })

    return new Response(
      JSON.stringify({ sent: sentCount, skipped: skippedCount }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    log.error('notification-digest: unhandled error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
})
