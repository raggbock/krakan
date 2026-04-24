import { createHash } from 'node:crypto'

/**
 * Extracts the coord-list segment from an OSRM route URL, e.g.
 *   https://router.project-osrm.org/route/v1/driving/11.97,57.70;11.96,57.71?...
 * returns "11.97,57.70;11.96,57.71".
 */
export function coordsFromUrl(url) {
  const seg = url.split('/driving/')[1]
  if (!seg) return ''
  return seg.split('?')[0]
}

/**
 * Stable 16-hex-char key for an OSRM coordinate string. Both the Playwright
 * route interceptor and the recorder script compute the key this way so
 * recorded fixtures can be looked up by URL at test time.
 */
export function hashCoords(coords) {
  return createHash('sha1').update(coords).digest('hex').slice(0, 16)
}
