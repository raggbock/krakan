/**
 * Snapshot / unit tests for notification-copy helpers.
 *
 * formatRelativeTime — Swedish relative time strings
 * formatEventText    — Swedish event descriptions
 * notificationTargetUrl — URL routing per event type
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime, formatEventText, notificationTargetUrl } from './notification-copy'
import type { NotificationInboxRow } from '@fyndstigen/shared'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<NotificationInboxRow> = {}): NotificationInboxRow {
  return {
    eventId: 'ev1',
    eventType: 'market.published',
    fleaMarketId: 'fm1',
    marketName: 'Testloppis',
    marketSlug: 'testloppis',
    citySlug: 'teststad',
    cityCanonicalName: 'Teststad',
    payload: {},
    occurredAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  }
}

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-05-12T12:00:00Z').getTime()

  afterEach(() => vi.useRealTimers())

  function withNow(ts: number, iso: string) {
    vi.setSystemTime(ts)
    return formatRelativeTime(iso)
  }

  it('returns "just nu" for 0 seconds ago', () => {
    const iso = new Date(NOW).toISOString()
    expect(withNow(NOW, iso)).toBe('just nu')
  })

  it('returns "just nu" for 30 seconds ago', () => {
    const iso = new Date(NOW - 30_000).toISOString()
    expect(withNow(NOW, iso)).toBe('just nu')
  })

  it('returns "5 min sedan" for 5 minutes ago', () => {
    const iso = new Date(NOW - 5 * 60_000).toISOString()
    expect(withNow(NOW, iso)).toBe('5 min sedan')
  })

  it('returns "1 timme sedan" for exactly 1 hour ago', () => {
    const iso = new Date(NOW - 60 * 60_000).toISOString()
    expect(withNow(NOW, iso)).toBe('1 timme sedan')
  })

  it('returns "2 timmar sedan" for 2 hours ago', () => {
    const iso = new Date(NOW - 2 * 60 * 60_000).toISOString()
    expect(withNow(NOW, iso)).toBe('2 timmar sedan')
  })

  it('returns "igår" for ~25 hours ago', () => {
    const iso = new Date(NOW - 25 * 60 * 60_000).toISOString()
    expect(withNow(NOW, iso)).toBe('igår')
  })

  it('returns "3 dagar sedan" for 3 days ago', () => {
    const iso = new Date(NOW - 3 * 24 * 60 * 60_000).toISOString()
    expect(withNow(NOW, iso)).toBe('3 dagar sedan')
  })
})

// ─── formatEventText ──────────────────────────────────────────────────────────

describe('formatEventText', () => {
  it('market.published — includes market name', () => {
    const result = formatEventText(makeRow({ eventType: 'market.published' }))
    expect(result).toBe('Testloppis är nu publicerad')
  })

  it('market.updated — includes market name', () => {
    const result = formatEventText(makeRow({ eventType: 'market.updated' }))
    expect(result).toBe('Testloppis har uppdaterat sin information')
  })

  it('market.new_date without anchor_date in payload', () => {
    const result = formatEventText(makeRow({ eventType: 'market.new_date', payload: {} }))
    expect(result).toBe('Testloppis har lagt till ett nytt datum')
  })

  it('market.new_date with anchor_date in payload', () => {
    const result = formatEventText(
      makeRow({
        eventType: 'market.new_date',
        payload: { anchor_date: '2026-06-15' },
      }),
    )
    // Swedish locale: "15 juni"
    expect(result).toContain('15 juni')
    expect(result).toContain('Testloppis')
  })

  it('block_sale.published — includes city name', () => {
    const result = formatEventText(makeRow({ eventType: 'block_sale.published' }))
    expect(result).toBe('En ny kvartersloppis har publicerats i Teststad')
  })

  it('falls back gracefully when marketName is null', () => {
    const result = formatEventText(makeRow({ marketName: null, eventType: 'market.updated' }))
    expect(result).toBe('En loppis har uppdaterat sin information')
  })

  it('falls back gracefully when cityCanonicalName is null', () => {
    const result = formatEventText(
      makeRow({ cityCanonicalName: null, eventType: 'block_sale.published' }),
    )
    expect(result).toBe('En ny kvartersloppis har publicerats i din stad')
  })
})

// ─── notificationTargetUrl ────────────────────────────────────────────────────

describe('notificationTargetUrl', () => {
  it('prefers marketSlug URL', () => {
    expect(notificationTargetUrl(makeRow({ marketSlug: 'min-loppis', citySlug: 'stockholm' }))).toBe(
      '/loppis/min-loppis',
    )
  })

  it('falls back to citySlug URL when marketSlug is null', () => {
    expect(notificationTargetUrl(makeRow({ marketSlug: null, citySlug: 'stockholm' }))).toBe(
      '/loppisar/stockholm',
    )
  })

  it('falls back to /profile/notiser when both are null', () => {
    expect(notificationTargetUrl(makeRow({ marketSlug: null, citySlug: null }))).toBe(
      '/profile/notiser',
    )
  })
})
