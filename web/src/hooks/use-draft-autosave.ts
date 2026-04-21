'use client'

import { useEffect, useRef } from 'react'

const SAVE_VERSION = 1

type DraftEnvelope<T> = {
  version: number
  savedAt: number
  data: T
}

export function useDraftAutosave<T>(
  key: string,
  data: T,
  options: { debounceMs?: number; enabled?: boolean } = {},
) {
  const { debounceMs = 500, enabled = true } = options
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        const envelope: DraftEnvelope<T> = {
          version: SAVE_VERSION,
          savedAt: Date.now(),
          data,
        }
        localStorage.setItem(key, JSON.stringify(envelope))
      } catch {
        // localStorage quota or serialization failure — drop silently;
        // the worst case is the user loses an autosave tick.
      }
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [key, data, debounceMs, enabled])
}

export function loadDraft<T>(key: string): { data: T; savedAt: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftEnvelope<T>
    if (parsed.version !== SAVE_VERSION) return null
    return { data: parsed.data, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export function clearDraft(key: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
