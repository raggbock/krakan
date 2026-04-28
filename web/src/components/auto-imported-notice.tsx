/**
 * Small disclaimer rendered on auto-imported (system-owned) markets to
 * warn visitors that the data may be stale and point them at the
 * canonical source. Two reasons we show this:
 *
 * 1. Trust — auto-imported hours drift over time and we'd rather have
 *    visitors arrive informed than complain when a shop turns out to be
 *    closed.
 * 2. Attribution — Google Places ToS requires source attribution when
 *    we display fields lifted from their API, including opening hours.
 *
 * Falls back gracefully through sources: prefers the shop's own website
 * (most likely to be accurate), then Google Maps via the cached
 * place_id, then nothing — at which point we just show a plain
 * "kan vara inaktuell"-text without a CTA.
 */
export function AutoImportedNotice({
  contactWebsite,
  googlePlaceId,
  what,
  plural = false,
}: {
  contactWebsite: string | null | undefined
  googlePlaceId: string | null | undefined
  /** "Öppettiderna" / "Adressen" — slots into the sentence template. */
  what: string
  /** Swedish adjective/participle agreement: plural for "Öppettiderna" so
   * we say "är hämtade ... inaktuella", singular for "Adressen" so we
   * say "är hämtad ... inaktuell". */
  plural?: boolean
}) {
  const link = contactWebsite
    ? { href: contactWebsite, label: 'butikens webbplats' }
    : googlePlaceId
      ? { href: `https://www.google.com/maps/place/?q=place_id:${googlePlaceId}`, label: 'Google Maps' }
      : null

  const participle = plural ? 'hämtade' : 'hämtad'
  const adjective = plural ? 'inaktuella' : 'inaktuell'

  return (
    <p className="text-xs text-espresso/65 mt-2 px-1 leading-relaxed">
      <span className="text-rust mr-1">ⓘ</span>
      {what} är {participle} automatiskt och kan vara {adjective}.
      {link && (
        <>
          {' '}Dubbelkolla på{' '}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rust underline hover:text-rust-light"
          >
            {link.label}
          </a>
          {' '}innan besök.
        </>
      )}
    </p>
  )
}
