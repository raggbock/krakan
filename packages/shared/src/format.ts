/**
 * Pure string / formatting utilities.
 *
 *   - getInitials    — first letter of up to the first two name words, uppercased.
 *   - slugifyCity    — URL-safe slug from a city name; handles Swedish characters.
 *   - formatDistance — meters → "N m" or "N.N km" (Swedish conventions).
 *   - formatDuration — seconds → "N min" or "N h M min".
 *
 * No side effects. All functions are safe to call in any runtime (browser, Node, Deno).
 */

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

const SLUG_CHAR_MAP: Record<string, string> = {
  å: 'a', ä: 'a', ö: 'o', é: 'e', è: 'e', ü: 'u',
  Å: 'a', Ä: 'a', Ö: 'o', É: 'e', È: 'e', Ü: 'u',
}

export function slugifyCity(city: string): string {
  return city
    .split('')
    .map((c) => SLUG_CHAR_MAP[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Format meters to a human-readable string */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Format seconds to a human-readable string */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}
