import { defineAdminEndpoint } from '../_shared/endpoint.ts'
import {
  AdminTakeoverFunnelInput,
  AdminTakeoverFunnelOutput,
} from '@fyndstigen/shared/contracts/admin-takeover-funnel.ts'

defineAdminEndpoint({
  name: 'admin-takeover-funnel',
  input: AdminTakeoverFunnelInput,
  output: AdminTakeoverFunnelOutput,
  handler: async ({ admin }) => {
    // The takeover_funnel view (00039) already excludes used / invalidated
    // / expired tokens, so we just read everything and order by most-
    // recent-sent at the SQL level. PostgREST default cap (1000) is fine —
    // active funnel will never approach that volume.
    const { data, error } = await admin
      .from('takeover_funnel')
      .select('*')
      .order('sent_at', { ascending: false, nullsFirst: false })
    if (error) throw new Error(error.message)

    const rows = (data ?? []).map((r) => ({
      tokenId: r.token_id as string,
      marketId: r.flea_market_id as string,
      marketName: r.market_name as string,
      marketSlug: (r.market_slug as string | null) ?? null,
      city: (r.city as string | null) ?? null,
      sentToEmail: (r.sent_to_email as string | null) ?? null,
      sentAt: (r.sent_at as string | null) ?? null,
      clickedAt: (r.clicked_at as string | null) ?? null,
      emailAttemptAt: (r.email_attempt_at as string | null) ?? null,
      emailAttemptCount: (r.email_attempt_count as number) ?? 0,
      lastFailureCode: (r.last_failure_code as string | null) ?? null,
      emailSubmitted: r.email_submitted as boolean,
      codeSent: r.code_sent as boolean,
      verificationAttempts: (r.verification_attempts as number) ?? 0,
      expiresAt: r.expires_at as string,
      daysSinceSent: Number(r.days_since_sent ?? 0),
      stage: r.stage as 'never_clicked' | 'clicked_only' | 'attempt_failed' | 'attempt_succeeded_unclaimed' | 'email_no_code' | 'code_sent_unverified',
    }))

    const summary = {
      total: rows.length,
      neverClicked: rows.filter((r) => r.stage === 'never_clicked').length,
      clickedOnly: rows.filter((r) => r.stage === 'clicked_only').length,
      attemptFailed: rows.filter((r) => r.stage === 'attempt_failed').length,
      attemptSucceededUnclaimed: rows.filter((r) => r.stage === 'attempt_succeeded_unclaimed').length,
      emailNoCode: rows.filter((r) => r.stage === 'email_no_code').length,
      codeSentUnverified: rows.filter((r) => r.stage === 'code_sent_unverified').length,
    }

    return { rows, summary }
  },
})
