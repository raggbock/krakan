'use client'

import { useState } from 'react'
import { api, geo } from '@/lib/api'
import {
  runMarketMutation,
  type MarketEvent,
  type MarketPlan,
} from '@fyndstigen/shared'
import { messageFor } from '@/lib/messages.sv'

type TableDraft = {
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

export type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

export type ExceptionDraft = {
  date: string
  reason: string | null
}

export type CreateMarketInput = {
  name: string
  description: string
  street: string
  zipCode: string
  city: string
  isPermanent: boolean
  organizerId: string
  autoAcceptBookings?: boolean
  tables: TableDraft[]
  images: File[]
  openingHours: RuleDraft[]
  openingHourExceptions: ExceptionDraft[]
  coordinates?: { latitude: number; longitude: number }
}

type Progress = 'idle' | 'geocoding' | 'creating' | 'tables' | 'images' | 'publishing'

export type ImageUploadStatus = {
  name: string
  state: 'pending' | 'uploading' | 'done' | 'error'
}

function progressFor(ev: MarketEvent): Progress | null {
  if (!('phase' in ev)) return null
  if (ev.status !== 'start') return null
  switch (ev.phase) {
    case 'geocoding':
      return 'geocoding'
    case 'saving_market':
      return 'creating'
    case 'publishing':
      return 'publishing'
    case 'saving_tables':
      return 'tables'
    case 'saving_images':
      return 'images'
  }
}

export function useCreateMarket() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>('idle')
  const [imageStatuses, setImageStatuses] = useState<ImageUploadStatus[]>([])

  async function submit(input: CreateMarketInput): Promise<{ id: string } | null> {
    setIsSubmitting(true)
    setError(null)
    setProgress('geocoding')
    setImageStatuses(input.images.map((f) => ({ name: f.name, state: 'pending' as const })))

    const plan: MarketPlan = {
      market: {
        create: {
          name: input.name,
          description: input.description,
          address: {
            street: input.street,
            zipCode: input.zipCode,
            city: input.city,
            country: 'Sweden',
            coordinates: input.coordinates,
          },
          isPermanent: input.isPermanent,
          organizerId: input.organizerId,
          autoAcceptBookings: input.autoAcceptBookings,
        },
      },
      images: { add: input.images, remove: [] },
      tables: {
        add: input.tables.map((t) => ({
          label: t.label,
          description: t.description,
          priceSek: t.priceSek,
          sizeDescription: t.sizeDescription,
        })),
        remove: [],
      },
      opening: { rules: input.openingHours, exceptions: input.openingHourExceptions },
    }

    let marketId: string | null = null
    let failedMsg: string | null = null
    let anyImageFailed = false
    let anyTableFailed = false
    let firstFailedTableLabel: string | null = null

    try {
      for await (const ev of runMarketMutation(plan, { api, geo })) {
        const next = progressFor(ev)
        if (next) setProgress(next)

        if ('type' in ev) {
          if (ev.type === 'complete') marketId = ev.marketId
          if (ev.type === 'failed') failedMsg = messageFor(ev.error)
          continue
        }

        // Flip the in-flight file to 'uploading' when the saga announces it
        // started, and to 'done'/'error' on resolution. Gives the user a
        // spinner on the file currently being processed instead of a silent
        // pending → done jump.
        if (
          ev.phase === 'saving_images' &&
          ev.status !== 'start' &&
          ev.status !== 'done' &&
          ev.kind === 'add'
        ) {
          if (ev.status === 'item_start') {
            setImageStatuses((prev) =>
              prev.map((s, idx) => (idx === ev.index ? { ...s, state: 'uploading' } : s)),
            )
          } else if (ev.status === 'item_ok') {
            setImageStatuses((prev) =>
              prev.map((s, idx) => (idx === ev.index ? { ...s, state: 'done' } : s)),
            )
          } else if (ev.status === 'item_error') {
            setImageStatuses((prev) =>
              prev.map((s, idx) => (idx === ev.index ? { ...s, state: 'error' } : s)),
            )
            anyImageFailed = true
          }
        }

        if (ev.phase === 'saving_tables' && ev.status === 'item_error' && ev.kind === 'add') {
          anyTableFailed = true
          if (!firstFailedTableLabel) {
            const t = input.tables[ev.index]
            firstFailedTableLabel = t?.label ?? null
          }
        }
      }
    } finally {
      setIsSubmitting(false)
      setProgress('idle')
    }

    if (failedMsg) {
      setError(failedMsg)
      return null
    }

    // Partial-success messages (preserve the old hook's user-visible wording).
    if (marketId && anyTableFailed) {
      setError(
        `Kunde inte skapa bord "${firstFailedTableLabel ?? ''}". Loppisen publicerades men vissa bord sparades inte.`,
      )
      return { id: marketId }
    }
    if (marketId && anyImageFailed) {
      setError(
        'Kunde inte ladda upp alla bilder. Loppisen publicerades men vissa bilder sparades inte.',
      )
      return { id: marketId }
    }

    return marketId ? { id: marketId } : null
  }

  return { submit, isSubmitting, error, progress, imageStatuses }
}
