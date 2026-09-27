/**
 * Which route serves a /loppis/<slug> request.
 *
 * The page exists twice: app/loppis/[slug] reads the session cookies so an
 * organizer can preview a draft, which makes it render per request, and
 * app/loppis-publik/[slug] is the same page with an anonymous client, cached
 * with ISR. Anonymous visitors cannot see drafts either way (RLS), so sending
 * them to the cached copy changes nothing they can see.
 *
 * Kept pure so the decision is tested apart from middleware.
 */
const DETAIL = /^\/loppis\/([^/]+)\/?$/
const PUBLIC_PREFIX = '/loppis-publik/'

export type LoppisRoute =
  | { kind: 'rewrite'; pathname: string }
  | { kind: 'redirect'; pathname: string }
  | { kind: 'pass' }

export function loppisRoute(pathname: string, signedIn: boolean): LoppisRoute {
  // The internal path must not be a second address for every market.
  if (pathname.startsWith(PUBLIC_PREFIX)) {
    return { kind: 'redirect', pathname: `/loppis/${pathname.slice(PUBLIC_PREFIX.length)}` }
  }
  const match = DETAIL.exec(pathname)
  if (match && !signedIn) return { kind: 'rewrite', pathname: `${PUBLIC_PREFIX}${match[1]}` }
  return { kind: 'pass' }
}
