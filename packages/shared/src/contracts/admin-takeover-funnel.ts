import { z } from 'zod'

/**
 * Per-token funnel rows for the admin takeover dashboard. Reads the
 * takeover_funnel SQL view and returns rows ordered by recency, with
 * a summary aggregation so the page can show counts at a glance.
 */
export const AdminTakeoverFunnelInput = z.object({})

export const FunnelStage = z.enum([
  'never_clicked',
  'clicked_only',
  'attempt_failed',
  'attempt_succeeded_unclaimed',
  'email_no_code',
  'code_sent_unverified',
])

export const FunnelRow = z.object({
  tokenId: z.string().uuid(),
  marketId: z.string().uuid(),
  marketName: z.string(),
  marketSlug: z.string().nullable(),
  city: z.string().nullable(),
  sentToEmail: z.string().nullable(),
  sentAt: z.string().nullable(),
  clickedAt: z.string().nullable(),
  emailAttemptAt: z.string().nullable(),
  emailAttemptCount: z.number().int(),
  lastFailureCode: z.string().nullable(),
  emailSubmitted: z.boolean(),
  codeSent: z.boolean(),
  verificationAttempts: z.number().int(),
  expiresAt: z.string(),
  daysSinceSent: z.number(),
  stage: FunnelStage,
})

export const FunnelSummary = z.object({
  total: z.number().int(),
  neverClicked: z.number().int(),
  clickedOnly: z.number().int(),
  attemptFailed: z.number().int(),
  attemptSucceededUnclaimed: z.number().int(),
  emailNoCode: z.number().int(),
  codeSentUnverified: z.number().int(),
})

export const AdminTakeoverFunnelOutput = z.object({
  rows: z.array(FunnelRow),
  summary: FunnelSummary,
})

export type AdminTakeoverFunnelOutput = z.infer<typeof AdminTakeoverFunnelOutput>
export type FunnelRow = z.infer<typeof FunnelRow>
