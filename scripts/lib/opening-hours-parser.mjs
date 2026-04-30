/**
 * Shared opening-hours regex parser used by enrich-opening-hours.mjs and
 * any future per-chain scraper (Stadsmissionen, Röda Korset, etc).
 *
 * Pure functions only — no I/O. Day-of-week numbers match Postgres
 * extract(dow): 0=Sunday … 6=Saturday.
 */

const DAY = {
  son: 0, sön: 0, sond: 0, sondag: 0, söndag: 0, sun: 0, sunday: 0,
  man: 1, män: 1, mån: 1, mandag: 1, måndag: 1, mon: 1, monday: 1,
  tis: 2, tisd: 2, tisdag: 2, tue: 2, tuesday: 2,
  ons: 3, onsd: 3, onsdag: 3, wed: 3, wednesday: 3,
  tor: 4, tors: 4, torsd: 4, torsdag: 4, thu: 4, thursday: 4,
  fre: 5, fred: 5, fredag: 5, fri: 5, friday: 5,
  lor: 6, lör: 6, lord: 6, lordag: 6, lördag: 6, sat: 6, saturday: 6,
}

function dayKeyToNum(s) {
  return DAY[s.toLowerCase().replace(/\.$/, '')] ?? null
}

const DAY_NAME = '(?:m[åa]n(?:dag)?|tis(?:dag)?|ons(?:dag)?|tor(?:s(?:dag)?)?|fre(?:dag)?|l[öo]r(?:dag)?|s[öo]n(?:dag)?)\\.?'
const TIME = '(\\d{1,2})(?:[.:](\\d{2}))?'
const DASH = '\\s*[-–—−]\\s*'
const SPACE = '\\s+'

function normalizeTimeFromParts(h, m) {
  const hr = Number(h)
  if (!Number.isFinite(hr) || hr < 0 || hr > 23) return null
  const min = m ? Number(m) : 0
  if (min < 0 || min > 59) return null
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function rangeOfDays(start, end) {
  const out = []
  if (start <= end) {
    for (let d = start; d <= end; d++) out.push(d)
  } else {
    for (let d = start; d <= 6; d++) out.push(d)
    for (let d = 0; d <= end; d++) out.push(d)
  }
  return out
}

const PATTERNS = [
  {
    re: new RegExp(`(${DAY_NAME})${DASH}(${DAY_NAME})${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const start = dayKeyToNum(m[1]); const end = dayKeyToNum(m[2])
      if (start == null || end == null) return null
      const open = normalizeTimeFromParts(m[3], m[4])
      const close = normalizeTimeFromParts(m[5], m[6])
      if (!open || !close) return null
      return rangeOfDays(start, end).map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  {
    re: new RegExp(`vardagar?${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [1, 2, 3, 4, 5].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  {
    re: new RegExp(`helger?${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [6, 0].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  {
    re: new RegExp(`(?:alla\\s+dagar|dagligen|varje\\s+dag|7\\s+dagar)${SPACE}${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const open = normalizeTimeFromParts(m[1], m[2])
      const close = normalizeTimeFromParts(m[3], m[4])
      if (!open || !close) return null
      return [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, open_time: open, close_time: close }))
    },
  },
  {
    re: new RegExp(`(${DAY_NAME})[\\s:]*${TIME}${DASH}${TIME}`, 'gi'),
    expand: (m) => {
      const d = dayKeyToNum(m[1])
      if (d == null) return null
      const open = normalizeTimeFromParts(m[2], m[3])
      const close = normalizeTimeFromParts(m[4], m[5])
      if (!open || !close) return null
      return [{ day_of_week: d, open_time: open, close_time: close }]
    },
  },
]

export function parseOpeningHours(text) {
  const all = []
  let bestSnippet = ''
  for (const { re, expand } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) != null) {
      const rules = expand(m)
      if (rules) {
        all.push(...rules)
        if (m[0].length > bestSnippet.length) bestSnippet = m[0]
      }
    }
  }
  const seen = new Set()
  const out = []
  for (const r of all) {
    const k = `${r.day_of_week}|${r.open_time}|${r.close_time}`
    if (!seen.has(k)) { seen.add(k); out.push(r) }
  }
  out.sort((a, b) => a.day_of_week - b.day_of_week)
  return { rules: out, snippet: bestSnippet }
}

import { plainTextLines } from './scrape-helpers.mjs'

export function extractCandidateText(html) {
  const lines = plainTextLines(html).split('\n').map((l) => l.trim()).filter(Boolean)
  const anchorRe = /[öo]ppet|[öo]ppettid|[öo]ppning|opening hours/i
  const anchors = []
  lines.forEach((l, i) => { if (anchorRe.test(l)) anchors.push(i) })
  if (anchors.length === 0) return lines.join('\n').slice(0, 4000)
  const keep = new Set()
  for (const i of anchors) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 10); j++) keep.add(j)
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join('\n')
}
