/**
 * Inline social links shown on the market detail page.
 *
 * Inputs come straight from the seller form, so they're tolerant of the
 * shapes people actually paste in:
 *   - `https://instagram.com/lillagrodans`
 *   - `https://www.instagram.com/lillagrodans/`
 *   - `@lillagrodans`
 *   - `lillagrodans`
 *
 * Anything that doesn't resolve to an http(s) URL or a recognizable handle
 * is hidden (no `javascript:` href, no raw text).
 */

function instagramUrl(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Plain URL — pass through if scheme is safe.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      if (u.hostname.endsWith('instagram.com')) return u.toString()
      return null
    } catch {
      return null
    }
  }
  // Handle — strip leading @ and any path slashes.
  const handle = trimmed.replace(/^@/, '').replace(/^\/+|\/+$/g, '')
  if (!handle || !/^[A-Za-z0-9._]+$/.test(handle)) return null
  return `https://instagram.com/${handle}`
}

function facebookUrl(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed)
      if (u.hostname.endsWith('facebook.com') || u.hostname.endsWith('fb.com')) return u.toString()
      return null
    } catch {
      return null
    }
  }
  // Facebook page slug.
  const handle = trimmed.replace(/^@/, '').replace(/^\/+|\/+$/g, '')
  if (!handle || !/^[A-Za-z0-9._-]+$/.test(handle)) return null
  return `https://facebook.com/${handle}`
}

export function SocialLinks({
  instagram,
  facebook,
}: {
  instagram: string | null
  facebook: string | null
}) {
  const ig = instagramUrl(instagram)
  const fb = facebookUrl(facebook)
  if (!ig && !fb) return null

  return (
    <div className="vintage-card p-5">
      <h2 className="font-display font-bold text-base mb-3">Följ på sociala medier</h2>
      <div className="flex gap-3">
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-parchment border border-cream-warm text-sm font-medium text-espresso hover:border-rust/40 hover:text-rust transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
            </svg>
            Instagram
          </a>
        )}
        {fb && (
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-parchment border border-cream-warm text-sm font-medium text-espresso hover:border-rust/40 hover:text-rust transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 8h2.5V4.5h-2.8c-2.2 0-3.7 1.4-3.7 3.6V11H7.5v3.5h2.5v6h3.5v-6H16l.5-3.5h-3v-2c0-.7.3-1 1-1Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            Facebook
          </a>
        )}
      </div>
    </div>
  )
}
