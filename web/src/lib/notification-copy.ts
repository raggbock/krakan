/**
 * Helpers for rendering notification copy in Swedish.
 *
 * formatEventText — turns a NotificationInboxRow into a human-readable
 *   Swedish description of what happened.
 *
 * formatRelativeTime — turns an ISO timestamp into Swedish relative time,
 *   e.g. "just nu", "5 min sedan", "2 timmar sedan", "igår", "3 dagar sedan".
 */
import type { NotificationInboxRow } from '@fyndstigen/shared'

/**
 * Returns the URL the user should navigate to when clicking a notification.
 *
 * market.* events link to /loppis/<slug> (or /loppisar/<citySlug> as fallback).
 * block_sale.published events link to /loppisar/<citySlug>.
 */
export function notificationTargetUrl(row: NotificationInboxRow): string {
  if (row.marketSlug) return `/loppis/${row.marketSlug}`
  if (row.citySlug) return `/loppisar/${row.citySlug}`
  return '/profile/notiser'
}

/**
 * Formats a notification row as a descriptive Swedish sentence.
 *
 * Examples:
 *   market.published    → "Erikshjälpen Skärblacka är nu publicerad"
 *   market.updated      → "Erikshjälpen Skärblacka har uppdaterat sin information"
 *   market.new_date     → "Erikshjälpen Skärblacka har lagt till ett nytt datum"
 *   block_sale.published → "En ny kvartersloppis har publicerats i Stockholm"
 */
export function formatEventText(row: NotificationInboxRow): string {
  const marketName = row.marketName ?? 'En loppis'
  const cityName = row.cityCanonicalName ?? 'din stad'

  switch (row.eventType) {
    case 'market.published':
      return `${marketName} är nu publicerad`

    case 'market.updated':
      return `${marketName} har uppdaterat sin information`

    case 'market.new_date': {
      const payload = row.payload as Record<string, unknown>
      const dateStr = payload['anchor_date']
        ? formatSwedishDate(String(payload['anchor_date']))
        : null
      return dateStr
        ? `${marketName} har lagt till ett nytt datum: ${dateStr}`
        : `${marketName} har lagt till ett nytt datum`
    }

    case 'block_sale.published':
      return `En ny kvartersloppis har publicerats i ${cityName}`

    default:
      return 'Ny notis'
  }
}

/**
 * Formats an ISO date string as a short Swedish date, e.g. "15 maj".
 */
function formatSwedishDate(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })
  } catch {
    return isoDate
  }
}

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Returns a Swedish relative time string for an ISO timestamp.
 *
 * Thresholds:
 *   < 1 min   → "just nu"
 *   < 1 hour  → "N min sedan"
 *   < 24 h    → "N timmar sedan" (or "1 timme sedan")
 *   < 48 h    → "igår"
 *   otherwise → "N dagar sedan"
 */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()

  if (diffMs < MINUTE_MS) return 'just nu'

  if (diffMs < HOUR_MS) {
    const mins = Math.floor(diffMs / MINUTE_MS)
    return `${mins} min sedan`
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS)
    return hours === 1 ? '1 timme sedan' : `${hours} timmar sedan`
  }

  if (diffMs < 2 * DAY_MS) return 'igår'

  const days = Math.floor(diffMs / DAY_MS)
  return `${days} dagar sedan`
}
