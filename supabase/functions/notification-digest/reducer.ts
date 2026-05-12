/**
 * notification-digest reducer — pure logic extracted from the I/O wrapper.
 *
 * Takes a snapshot of the world (pending deliveries per user + their prefs)
 * and returns a list of DigestCommand objects. The I/O wrapper executes them.
 *
 * Mirrors the stripe-webhook pattern: testable without network/DB.
 */

import { buildDigest } from '@fyndstigen/shared/notifications/digest-builder.ts'
import type { NotificationDeliveryRow } from '@fyndstigen/shared/notifications/digest-builder.ts'

export type { NotificationDeliveryRow }

export type UserDigestInput = {
  userId: string
  email: string
  unsubscribeToken: string
  deliveries: NotificationDeliveryRow[]
}

export type DigestCommand =
  | { type: 'send_email'; userId: string; to: string; subject: string; html: string; text: string; deliveryIds: string[] }
  | { type: 'skip_empty'; userId: string }
  | { type: 'skip_no_prefs'; userId: string }

/**
 * Pure reducer: given a list of users with their pending deliveries,
 * returns commands to execute (send email or skip).
 */
export function buildDigestCommands(
  users: UserDigestInput[],
  baseUrl: string,
): DigestCommand[] {
  const commands: DigestCommand[] = []

  for (const user of users) {
    const digest = buildDigest({
      userId: user.userId,
      recipientEmail: user.email,
      deliveries: user.deliveries,
      unsubscribeToken: user.unsubscribeToken,
      baseUrl,
    })

    if (!digest) {
      commands.push({ type: 'skip_empty', userId: user.userId })
      continue
    }

    commands.push({
      type: 'send_email',
      userId: user.userId,
      to: user.email,
      subject: digest.emailSubject,
      html: digest.emailHtml,
      text: digest.emailPlaintext,
      deliveryIds: user.deliveries.map((d) => d.id),
    })
  }

  return commands
}
