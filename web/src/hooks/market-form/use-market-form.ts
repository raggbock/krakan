'use client'

import type { FleaMarketDetails, MarketTable } from '@/lib/api'
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
  initial?: FleaMarketDetails & { market_tables?: MarketTable[] }
  /** For create mode: the organizer's user id. */
  organizerId?: string
}

export function useMarketForm({ mode, initial, organizerId }: UseMarketFormOptions) {
  const fields = useMarketFields(initial)

  const openingHours = useOpeningHoursDraft(
    initial?.opening_hour_rules?.map((r) => ({
      type: r.type as 'weekly' | 'biweekly' | 'date',
      dayOfWeek: r.day_of_week,
      anchorDate: r.anchor_date,
      openTime: r.open_time,
      closeTime: r.close_time,
    })) ?? [],
    initial?.opening_hour_exceptions?.map((ex) => ({
      date: ex.date,
      reason: ex.reason,
    })) ?? [],
  )

  const images = useImageDraft(initial?.flea_market_images ?? [])

  const tables = useTableDraft(initial?.market_tables ?? [])

  const { submit, state, clearError, clearSuccess } = useSubmitMarket({
    mode,
    marketId: initial?.id,
    publishedAt: initial?.published_at,
    organizerId: organizerId ?? initial?.organizer_id,
    autoAcceptBookings: fields.autoAcceptBookings,
    fields,
    openingHours,
    images,
    tables,
  })

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
