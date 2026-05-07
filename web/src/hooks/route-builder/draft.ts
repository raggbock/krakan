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
