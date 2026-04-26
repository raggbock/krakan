/**
 * Pure helpers shared across all scripts/fetch-*.mjs scrapers.
 *
 * Lifted from the seven existing scrapers where each had its own copy
 * with subtle drift (e.g. different slugify char ranges). Single source
 * of truth so a fix in one place benefits all chains.
 *
 * Pure: no I/O, no mutation, no globals. Safe to import from any context.
 */

/** URL-safe slug from arbitrary text. å/ä→a, ö→o, lowercase, dash-separated, ≤60 chars. */
export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Great-circle distance between two lat/lng points, rounded to 0.1 km. */
export function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10
}

/** Promise-based sleep. */
export function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

/** Decode HTML entities (&amp; &nbsp; &aring; numeric refs etc) without an HTML parser. */
export function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aring;/g, 'å').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
    .replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

/** Strip tags, decode entities, collapse whitespace. */
export function plainText(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
}

/** Strip tags but preserve newlines (one tag = one newline). For per-line parsing. */
export function plainTextLines(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n'))
}

/**
 * Normalise a Swedish phone number to E.164. Accepts any combination of
 * spaces, dashes, parentheses, and leading 0 / 00 / +. Returns null if
 * input is empty.
 */
export function normalizePhone(raw) {
  if (!raw) return null
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = '+' + digits.slice(2)
  if (digits.startsWith('0')) digits = '+46' + digits.slice(1)
  if (!digits.startsWith('+')) digits = '+46' + digits
  return digits
}

/**
 * Extract the first phone number from an HTML page by looking for
 * tel: hrefs. Returns { phone, phoneRaw } or null.
 */
export function extractPhoneFromTelHref(html) {
  const m = /href=["']tel:([+\d\s\-()]+)["']/i.exec(html)
  if (!m) return null
  const raw = m[1].trim()
  const phone = normalizePhone(raw)
  return phone ? { phone, phoneRaw: raw } : null
}

/** Extract the first email address from a mailto: href. */
export function extractEmailFromMailto(html) {
  const m = /mailto:([\w.+-]+@[\w.-]+\.[a-z]{2,})/i.exec(html)
  return m ? m[1].toLowerCase() : null
}

/**
 * Convert HH:MM[:SS] (with either : or . separator) to canonical HH:MM.
 * Returns null on parse failure.
 */
export function normalizeTime(t) {
  const m = /(\d{1,2})[.:](\d{2})/.exec(t)
  if (!m) return null
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

/** Read all <loc> URLs from an XML sitemap, optionally filtered by regex. */
export async function fetchSitemapUrls(url, opts = {}) {
  const { userAgent = 'Fyndstigen/1.0', filter } = opts
  const res = await fetch(url, { headers: { 'user-agent': userAgent } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const xml = await res.text()
  const urls = []
  const re = /<loc>\s*([^<]+)\s*<\/loc>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim()
    if (!filter || filter.test(u)) urls.push(u)
  }
  return urls
}

/**
 * Geocode a free-form Swedish address via Nominatim. Caller is
 * responsible for the 1 req/s pacing.
 */
export async function nominatimGeocode(query, opts = {}) {
  const { userAgent = 'Fyndstigen/1.0' } = opts
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { 'user-agent': userAgent, 'accept-language': 'sv' } })
  if (!res.ok) return null
  const arr = await res.json()
  if (!arr.length) return null
  const r = arr[0]
  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    region: r.address?.state || r.address?.county || null,
    municipality: r.address?.municipality || r.address?.city_district || r.address?.city || r.address?.town || r.address?.village || null,
    postalCode: r.address?.postcode || null,
    locality: r.address?.city || r.address?.town || r.address?.village || r.address?.suburb || null,
  }
}

/** Reference point for distance-from-Örebro calculations. */
export const ÖREBRO = { lat: 59.2741, lng: 15.2066 }
