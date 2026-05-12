/**
 * Tests for the notification-digest pure reducer.
 * No I/O, no network, no Supabase client.
 *
 * Run with:
 *   deno test --allow-all --import-map=supabase/functions/deno.json \
 *     supabase/functions/notification-digest/reducer.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { buildDigestCommands } from './reducer.ts'
import type { UserDigestInput } from './reducer.ts'
import type { NotificationDeliveryRow } from '@fyndstigen/shared/notifications/digest-builder.ts'

const BASE_URL = 'https://fyndstigen.se'

function makeUser(overrides: Partial<UserDigestInput> = {}): UserDigestInput {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    unsubscribeToken: 'token-abc',
    deliveries: [],
    ...overrides,
  }
}

function makeDelivery(overrides: Partial<NotificationDeliveryRow> = {}): NotificationDeliveryRow {
  return {
    id: 'delivery-1',
    userId: 'user-1',
    eventId: 'event-1',
    reason: 'market',
    channel: 'email',
    status: 'pending',
    createdAt: '2026-05-12T06:00:00Z',
    eventType: 'market.updated',
    eventPayload: { market_name: 'Testloppis', slug: 'testloppis' },
    occurredAt: '2026-05-12T05:00:00Z',
    fleaMarketId: 'market-1',
    citySlug: 'stockholm',
    ...overrides,
  }
}

Deno.test('empty users list → empty commands', () => {
  const cmds = buildDigestCommands([], BASE_URL)
  assertEquals(cmds.length, 0)
})

Deno.test('user with no deliveries → skip_empty command', () => {
  const cmds = buildDigestCommands([makeUser({ deliveries: [] })], BASE_URL)
  assertEquals(cmds.length, 1)
  assertEquals(cmds[0].type, 'skip_empty')
  assertEquals(cmds[0].userId, 'user-1')
})

Deno.test('user with 1 delivery → send_email command with correct fields', () => {
  const delivery = makeDelivery()
  const user = makeUser({ deliveries: [delivery] })
  const cmds = buildDigestCommands([user], BASE_URL)

  assertEquals(cmds.length, 1)
  assertEquals(cmds[0].type, 'send_email')
  if (cmds[0].type !== 'send_email') return

  assertEquals(cmds[0].userId, 'user-1')
  assertEquals(cmds[0].to, 'user@example.com')
  assertEquals(cmds[0].subject, 'Fyndstigen: 1 ny händelse')
  assertEquals(cmds[0].deliveryIds, ['delivery-1'])
  assertEquals(cmds[0].html.includes('Testloppis'), true)
  assertEquals(cmds[0].text.includes('Testloppis'), true)
})

Deno.test('multiple users — each gets their own command', () => {
  const users: UserDigestInput[] = [
    makeUser({ userId: 'user-1', email: 'a@example.com', deliveries: [makeDelivery({ id: 'd-1' })] }),
    makeUser({ userId: 'user-2', email: 'b@example.com', deliveries: [] }),
    makeUser({
      userId: 'user-3',
      email: 'c@example.com',
      deliveries: [
        makeDelivery({ id: 'd-2', userId: 'user-3' }),
        makeDelivery({ id: 'd-3', userId: 'user-3', eventId: 'event-2' }),
      ],
    }),
  ]

  const cmds = buildDigestCommands(users, BASE_URL)
  assertEquals(cmds.length, 3)

  const user1Cmd = cmds.find((c) => c.userId === 'user-1')
  const user2Cmd = cmds.find((c) => c.userId === 'user-2')
  const user3Cmd = cmds.find((c) => c.userId === 'user-3')

  assertEquals(user1Cmd?.type, 'send_email')
  assertEquals(user2Cmd?.type, 'skip_empty')
  assertEquals(user3Cmd?.type, 'send_email')

  if (user3Cmd?.type === 'send_email') {
    assertEquals(user3Cmd.deliveryIds.length, 2)
    assertEquals(user3Cmd.subject, 'Fyndstigen: 2 nya händelser')
  }
})

Deno.test('unsubscribe URL is embedded in email output', () => {
  const user = makeUser({
    unsubscribeToken: 'my-special-token',
    deliveries: [makeDelivery()],
  })
  const cmds = buildDigestCommands([user], BASE_URL)

  assertEquals(cmds[0].type, 'send_email')
  if (cmds[0].type !== 'send_email') return
  assertEquals(cmds[0].html.includes('/unsubscribe?token=my-special-token'), true)
  assertEquals(cmds[0].text.includes('/unsubscribe?token=my-special-token'), true)
})
