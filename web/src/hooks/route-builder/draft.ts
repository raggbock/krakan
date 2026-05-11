// Draft persistence helpers — moved here from route-builder.tsx.
// Pure functions; no React imports so they can be tested in isolation.

export const DRAFT_KEY = 'fyndstigen.route-draft.v1'
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export type RouteDraft = {
  name: string
  plannedDate: string
  useGps: boolean
  customStart: { lat: number; lng: number } | null
  stops: Array<{ marketId: string; index: number }>
  savedAt: string // ISO
}

export function readDraft(storage: Storage, now: () => number): RouteDraft | null {
  try {
    const raw = storage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RouteDraft
    if (!parsed.savedAt) return null
    const age = now() - Date.parse(parsed.savedAt)
    if (age > DRAFT_MAX_AGE_MS) {
      storage.removeItem(DRAFT_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeDraft(storage: Storage, draft: RouteDraft): void {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // localStorage unavailable (private browsing / quota exceeded) — no-op
  }
}

export function clearDraft(storage: Storage): void {
  try {
    storage.removeItem(DRAFT_KEY)
  } catch {
    // no-op
  }
}

/**
 * Append a market to the draft (or initialize one). Used by the
 * "Lägg till i rundan" button on market-detail and explore cards (#139)
 * so users can build a route from outside the route-builder page.
 *
 * Idempotent: if the marketId is already in the draft, returns the
 * existing draft unchanged. Returns the resulting draft so callers can
 * tell whether the stop count grew (for telemetry / UI confirmation).
 */
export function addStopToDraft(
  storage: Storage,
  marketId: string,
  now: () => number = Date.now,
): { draft: RouteDraft; added: boolean } {
  const existing = readDraft(storage, now)
  if (existing?.stops.some((s) => s.marketId === marketId)) {
    return { draft: existing, added: false }
  }
  const base: RouteDraft = existing ?? {
    name: '',
    plannedDate: '',
    useGps: true,
    customStart: null,
    stops: [],
    savedAt: new Date(now()).toISOString(),
  }
  const next: RouteDraft = {
    ...base,
    stops: [...base.stops, { marketId, index: base.stops.length }],
    savedAt: new Date(now()).toISOString(),
  }
  writeDraft(storage, next)
  return { draft: next, added: true }
}

/** Check if a market is already in the current draft. */
export function isMarketInDraft(
  storage: Storage,
  marketId: string,
  now: () => number = Date.now,
): boolean {
  const draft = readDraft(storage, now)
  return draft?.stops.some((s) => s.marketId === marketId) ?? false
}
