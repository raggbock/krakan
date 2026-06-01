'use client'

import { useEffect, useRef } from 'react'
import type { FleaMarketDetailsView, MarketTableView } from '@fyndstigen/shared'
import { useMarketFields } from './use-market-fields'
import { useOpeningHoursDraft } from './use-opening-hours-draft'
import { useImageDraft } from './use-image-draft'
import { useTableDraft } from './use-table-draft'
import { useSubmitMarket } from './use-submit-market'
import type { RuleDraft, ExceptionDraft } from '@fyndstigen/shared'

export type { RuleDraft, ExceptionDraft }
export type { ImageUploadStatus } from './use-submit-market'
export type { TableDraftRow } from './use-table-draft'
export type { ImageDraftExisting } from './use-image-draft'

export type UseMarketFormOptions = {
  mode: 'create' | 'edit'
  /** For edit mode: the full market details to initialize from. */
  initial?: FleaMarketDetailsView & { market_tables?: MarketTableView[] }
  /** For create mode: the organizer's user id. */
  organizerId?: string
  /** When false, tables are excluded from the mutation plan (default: true). */
  includeTables?: boolean
}

export function useMarketForm({ mode, initial, organizerId, includeTables }: UseMarketFormOptions) {
  const fields = useMarketFields(initial)

  const openingHours = useOpeningHoursDraft(
    initial?.openingHourRules?.map((r) => ({
      type: r.type as 'weekly' | 'biweekly' | 'date',
      dayOfWeek: r.dayOfWeek,
      anchorDate: r.anchorDate,
      openTime: r.openTime,
      closeTime: r.closeTime,
    })) ?? [],
    initial?.openingHourExceptions?.map((ex) => ({
      date: ex.date,
      reason: ex.reason,
    })) ?? [],
  )

  const images = useImageDraft(
    (initial?.images ?? []).map((img) => ({
      id: img.id,
      storagePath: img.storagePath,
      sortOrder: img.sortOrder,
    })),
  )

  const tables = useTableDraft(initial?.market_tables ?? [])

  const { submit, state, clearError, clearSuccess } = useSubmitMarket({
    mode,
    marketId: initial?.id,
    publishedAt: initial?.publishedAt,
    organizerId: organizerId ?? initial?.organizerId,
    autoAcceptBookings: fields.autoAcceptBookings,
    fields,
    openingHours,
    images,
    tables,
    includeTables,
  })

  // Re-seed sub-hooks when `initial` changes (e.g. edit page reloads after save).
  // Skip the first run — useState(initial) already handled the initial mount.
  const prevInitialRef = useRef(initial)
  useEffect(() => {
    if (!initial) return
    if (prevInitialRef.current === initial) return
    prevInitialRef.current = initial

    fields.reset(initial)
    openingHours.reset(
      initial.openingHourRules?.map((r) => ({
        type: r.type as 'weekly' | 'biweekly' | 'date',
        dayOfWeek: r.dayOfWeek,
        anchorDate: r.anchorDate,
        openTime: r.openTime,
        closeTime: r.closeTime,
      })) ?? [],
      initial.openingHourExceptions?.map((ex) => ({
        date: ex.date,
        reason: ex.reason,
      })) ?? [],
    )
    images.reset(
      (initial.images ?? []).map((img) => ({
        id: img.id,
        storagePath: img.storagePath,
        sortOrder: img.sortOrder,
      })),
    )
    tables.reset(initial.market_tables ?? [])
  }, [initial, fields, openingHours, images, tables])

  return {
    fields,
    openingHours,
    images,
    tables,
    submit,
    status: state,
    clearError,
    clearSuccess,
  }
}
