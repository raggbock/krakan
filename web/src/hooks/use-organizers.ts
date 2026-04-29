'use client'

import { useEffect, useState } from 'react'
import type { OrganizerProfile, OrganizerStats } from '@fyndstigen/shared'
import { useDeps } from '@/providers/deps-provider'
import { isAppError, messageFor } from '@fyndstigen/shared'

// ─── useOrganizer ──────────────────────────────────────────────────────────

export type UseOrganizerResult = {
  organizer: OrganizerProfile | null
  loading: boolean
  error: string | null
}

/**
 * Fetch an organizer profile by user id.
 * Returns null until loaded; error if the request fails.
 */
export function useOrganizer(id: string | undefined): UseOrganizerResult {
  const { organizers } = useDeps()
  const [organizer, setOrganizer] = useState<OrganizerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    organizers
      .get(id)
      .then((org) => {
        setOrganizer(org)
        setError(null)
      })
      .catch((err) => {
        setOrganizer(null)
        setError(isAppError(err) ? messageFor(err) : err instanceof Error ? err.message : 'Kunde inte hämta arrangör')
      })
      .finally(() => setLoading(false))
  }, [id, organizers])

  return { organizer, loading, error }
}

// ─── useOrganizerSimpleStats ───────────────────────────────────────────────

export type UseOrganizerSimpleStatsResult = {
  stats: OrganizerStats | null
  loading: boolean
  error: string | null
}

/**
 * Fetch the simple (SQL-aggregated) stats for an organizer.
 * Distinct from useOrganizerStats (which merges PostHog data and is used on
 * the full statistics dashboard). This is the lightweight version used by
 * the bokningar page.
 */
export function useOrganizerSimpleStats(userId: string | undefined): UseOrganizerSimpleStatsResult {
  const { organizers } = useDeps()
  const [stats, setStats] = useState<OrganizerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setError(null)
    organizers
      .stats(userId)
      .then((s) => {
        setStats(s)
        setError(null)
      })
      .catch((err) => {
        setError(isAppError(err) ? messageFor(err) : err instanceof Error ? err.message : 'Kunde inte hämta statistik')
      })
      .finally(() => setLoading(false))
  }, [userId, organizers])

  return { stats, loading, error }
}

// ─── useUpdateOrganizer ────────────────────────────────────────────────────

export type OrganizerUpdateFields = Partial<
  Pick<OrganizerProfile, 'bio' | 'website' | 'first_name' | 'last_name' | 'phone_number'>
>

export type UseUpdateOrganizerResult = {
  update: (userId: string, fields: OrganizerUpdateFields) => Promise<void>
  saving: boolean
  saved: boolean
  error: string
}

/**
 * Mutation hook for saving organizer profile edits.
 */
export function useUpdateOrganizer(): UseUpdateOrganizerResult {
  const { organizers } = useDeps()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function update(userId: string, fields: OrganizerUpdateFields): Promise<void> {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await organizers.update(userId, fields)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Kunde inte spara. Försök igen.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  return { update, saving, saved, error }
}
