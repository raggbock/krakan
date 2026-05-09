/**
 * useMarketCuration — client-side filter/sort for the admin markets list.
 *
 * Accepts the full `AdminMarketRow[]` array and returns a derived view with:
 *   - `filtered`  — rows matching the active filter set
 *   - `sorted`    — filtered rows in the requested sort order
 *   - `counts`    — pre-computed aggregate counts for the filter badges
 *   - state setters for activeFilters, sortKey, sortDir, and search query
 *
 * All filtering and sorting is pure client-side (no re-fetch). The hook
 * composes `marketCompleteness` from the domain layer to compute missing-
 * field counts for each market row.
 */

'use client'

import { useMemo, useState } from 'react'
import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'
import { marketCompleteness } from '@fyndstigen/shared/domain/market-completeness'

export type FilterKey =
  | 'unpublished' | 'system_owned' | 'claimed' | 'unverified' | 'closed'
  | 'complete' | 'almost_complete' | 'published_no_takeover'
  | 'missing_street' | 'missing_zip' | 'missing_coords'
  | 'missing_website' | 'missing_phone' | 'missing_email' | 'missing_hours'
  | 'has_street' | 'has_zip' | 'has_coords'
  | 'has_website' | 'has_phone' | 'has_email' | 'has_hours'

export type SortKey = 'name' | 'city' | 'updated' | 'status'
export type SortDir = 'asc' | 'desc'

export type CurationCounts = {
  total: number
  complete: number
  unpublished: number
  systemOwned: number
  claimed: number
  missingContact: number
  missingHours: number
}

export type MarketCurationState = {
  filtered: AdminMarketRow[]
  counts: CurationCounts
  selection: Set<string>
  activeFilters: Set<FilterKey>
  sortKey: SortKey
  sortDir: SortDir
  search: string
}

export type MarketCurationActions = {
  setFilter: (key: FilterKey) => void
  setSort: (key: SortKey, dir: SortDir) => void
  setSearch: (q: string) => void
  toggleSelection: (id: string, on: boolean) => void
  selectAll: () => void
  clearSelection: () => void
}

export function useMarketCuration(rows: AdminMarketRow[]): MarketCurationState & MarketCurationActions {
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let r = rows
    if (!activeFilters.has('closed')) r = r.filter((m) => m.status !== 'closed')
    if (activeFilters.has('unpublished')) r = r.filter((m) => !m.isPublished)
    if (activeFilters.has('system_owned')) r = r.filter((m) => m.isSystemOwned)
    if (activeFilters.has('claimed')) r = r.filter((m) => !m.isSystemOwned)
    if (activeFilters.has('unverified')) r = r.filter((m) => m.status === 'unverified')
    if (activeFilters.has('complete')) r = r.filter((m) => marketCompleteness(m).isComplete)
    if (activeFilters.has('almost_complete')) {
      r = r.filter((m) => {
        const c = marketCompleteness(m)
        return c.isAlmostComplete && !c.isComplete
      })
    }
    if (activeFilters.has('published_no_takeover')) {
      r = r.filter((m) => m.isPublished && m.isSystemOwned && !m.takeover?.sentAt)
    }
    if (activeFilters.has('missing_street')) r = r.filter((m) => !m.street)
    if (activeFilters.has('missing_zip')) r = r.filter((m) => !m.zipCode)
    if (activeFilters.has('missing_coords')) r = r.filter((m) => !m.hasCoordinates)
    if (activeFilters.has('missing_website')) r = r.filter((m) => !m.hasWebsite)
    if (activeFilters.has('missing_phone')) r = r.filter((m) => !m.hasPhone)
    if (activeFilters.has('missing_email')) r = r.filter((m) => !m.hasEmail)
    if (activeFilters.has('missing_hours')) r = r.filter((m) => !m.hasOpeningHours)
    if (activeFilters.has('has_street')) r = r.filter((m) => !!m.street)
    if (activeFilters.has('has_zip')) r = r.filter((m) => !!m.zipCode)
    if (activeFilters.has('has_coords')) r = r.filter((m) => m.hasCoordinates)
    if (activeFilters.has('has_website')) r = r.filter((m) => m.hasWebsite)
    if (activeFilters.has('has_phone')) r = r.filter((m) => m.hasPhone)
    if (activeFilters.has('has_email')) r = r.filter((m) => m.hasEmail)
    if (activeFilters.has('has_hours')) r = r.filter((m) => m.hasOpeningHours)

    const q = search.trim().toLowerCase()
    if (q) {
      r = r.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        (m.slug ?? '').toLowerCase().includes(q) ||
        (m.city ?? '').toLowerCase().includes(q),
      )
    }

    const dirMul = sortDir === 'asc' ? 1 : -1
    return [...r].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dirMul * a.name.localeCompare(b.name, 'sv')
        case 'city': return dirMul * (a.city ?? '').localeCompare(b.city ?? '', 'sv')
        case 'updated': return dirMul * ((a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''))
        case 'status': {
          const rank = (m: AdminMarketRow) => (m.isPublished ? 0 : 2) + (m.isSystemOwned ? 1 : 0)
          return dirMul * (rank(a) - rank(b))
        }
      }
    })
  }, [rows, activeFilters, search, sortKey, sortDir])

  const counts = useMemo((): CurationCounts => ({
    total: rows.length,
    complete: rows.filter((m) => marketCompleteness(m).isComplete).length,
    unpublished: rows.filter((m) => !m.isPublished).length,
    systemOwned: rows.filter((m) => m.isSystemOwned).length,
    claimed: rows.filter((m) => !m.isSystemOwned).length,
    missingContact: rows.filter((m) => !m.hasWebsite && !m.hasPhone && !m.hasEmail).length,
    missingHours: rows.filter((m) => !m.hasOpeningHours).length,
  }), [rows])

  function setFilter(key: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function setSort(key: SortKey, dir: SortDir) {
    setSortKey(key)
    setSortDir(dir)
  }

  function toggleSelection(id: string, on: boolean) {
    setSelection((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function selectAll() {
    setSelection((prev) => {
      const next = new Set(prev)
      filtered.forEach((m) => next.add(m.id))
      return next
    })
  }

  function clearSelection() {
    setSelection(new Set())
  }

  return {
    filtered,
    counts,
    selection,
    activeFilters,
    sortKey,
    sortDir,
    search,
    setFilter,
    setSort,
    setSearch,
    toggleSelection,
    selectAll,
    clearSelection,
  }
}
