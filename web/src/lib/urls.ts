/**
 * Canonical URL helpers. Keep all internal market/route/organizer URLs
 * funnelled through these so a structural change (e.g. /fleamarkets → /loppis)
 * is a one-line update instead of a 22-file find-replace.
 */

/**
 * Public URL for a market detail page. Prefers the slug-based path; falls
 * back to the legacy UUID path only when slug is missing (shouldn't happen
 * in production — every flea_market has a unique slug — but defensible
 * for in-progress drafts the moment before the slug is generated).
 */
export function marketUrl(market: { id: string; slug?: string | null }): string {
  return market.slug ? `/loppis/${market.slug}` : `/fleamarkets/${market.id}`
}

/** Edit URL stays UUID-keyed — admin/owner-only, slug doesn't add value. */
export function marketEditUrl(market: { id: string }): string {
  return `/fleamarkets/${market.id}/edit`
}
