'use client'

import { useCallback, useRef, useState } from 'react'
import { geo } from '@/lib/geo'
import { runMarketMutation } from '@fyndstigen/shared'
import { useDeps } from '@/providers/deps-provider'
import { messageFor } from '@/lib/messages.sv'
import type { MarketFields } from './use-market-fields'
import type { OpeningHoursDraftResult } from './use-opening-hours-draft'
import type { ImageDraftResult } from './use-image-draft'
import type { TableDraftResult } from './use-table-draft'

export type ImageUploadStatus = {
  name: string
  state: 'pending' | 'uploading' | 'done' | 'error'
}

export type Progress = 'idle' | 'geocoding' | 'creating' | 'tables' | 'images' | 'publishing'

export type SubmitMarketResult =
  | { ok: true; marketId: string }
  | { ok: false; error: string }

export type SubmitMarketState = {
  isSubmitting: boolean
  progress: Progress
  imageStatuses: ImageUploadStatus[]
  error: string | null
  success: string | null
}

export type UseSubmitMarketOptions = {
  mode: 'create' | 'edit'
  marketId?: string
  publishedAt?: string | null
  organizerId?: string
  autoAcceptBookings?: boolean
  fields: MarketFields
  openingHours: OpeningHoursDraftResult
  images: ImageDraftResult
  tables: TableDraftResult
  onSuccess?: (marketId: string) => void
}

/**
 * Wires the market-mutation saga to the sub-hook state slices.
 * Uses a ref to always read the latest option values so the
 * `submit` callback is stable across renders.
 */
export function useSubmitMarket(opts: UseSubmitMarketOptions): {
  submit: () => Promise<SubmitMarketResult>
  state: SubmitMarketState
  clearError: () => void
  clearSuccess: () => void
} {
  const { markets, marketTables, images: imagesPort } = useDeps()

  // Keep latest opts in a ref so submit() never goes stale.
  const optsRef = useRef(opts)
  optsRef.current = opts

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<Progress>('idle')
  const [imageStatuses, setImageStatuses] = useState<ImageUploadStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = useCallback(async (): Promise<SubmitMarketResult> => {
    const { mode, marketId, publishedAt, organizerId, autoAcceptBookings,
            fields, openingHours, images, tables, onSuccess } = optsRef.current

    if (!fields.isValid) {
      const msg = 'Fyll i namn, gatuadress och stad.'
      setError(msg)
      return { ok: false, error: msg }
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    const imageSer = images.serialize()
    setImageStatuses(imageSer.add.map((f) => ({ name: f.name, state: 'pending' as const })))

    const { rules, exceptions } = openingHours.serialize()
    const tablesSer = tables.serialize()

    const address = {
      street: fields.address.street.trim(),
      zipCode: fields.address.zipCode.trim(),
      city: fields.address.city.trim(),
      country: 'Sweden' as const,
      coordinates:
        fields.address.latitude && fields.address.longitude
          ? { latitude: fields.address.latitude, longitude: fields.address.longitude }
          : undefined,
    }

    const plan =
      mode === 'create'
        ? {
            market: {
              create: {
                name: fields.name.trim(),
                description: fields.description.trim(),
                address,
                isPermanent: fields.isPermanent,
                organizerId: organizerId!,
                autoAcceptBookings,
              },
            },
            images: { add: imageSer.add, remove: imageSer.remove },
            tables: { add: tablesSer.add, remove: tablesSer.remove },
            opening: { rules, exceptions },
          }
        : {
            market: {
              update: {
                id: marketId!,
                patch: {
                  name: fields.name.trim(),
                  description: fields.description.trim(),
                  address,
                  isPermanent: fields.isPermanent,
                  alreadyPublished: publishedAt != null,
                },
              },
            },
            images: { add: imageSer.add, remove: imageSer.remove },
            tables: { add: tablesSer.add, remove: tablesSer.remove },
            opening: { rules, exceptions },
          }

    let resolvedMarketId: string | null = null
    let failedMsg: string | null = null
    let anyItemError = false
    let firstFailedTableLabel: string | null = null

    try {
      for await (const ev of runMarketMutation(plan, { markets, marketTables, images: imagesPort, geo })) {
        if ('type' in ev) {
          if (ev.type === 'complete') resolvedMarketId = ev.marketId
          if (ev.type === 'failed') failedMsg = messageFor(ev.error)
          continue
        }

        if (ev.status === 'start') {
          switch (ev.phase) {
            case 'geocoding': setProgress('geocoding'); break
            case 'saving_market': setProgress('creating'); break
            case 'saving_tables': setProgress('tables'); break
            case 'saving_images': setProgress('images'); break
            case 'publishing': setProgress('publishing'); break
          }
        }

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
            anyItemError = true
          }
        }

        if (ev.phase === 'saving_tables' && ev.status === 'item_error' && ev.kind === 'add') {
          anyItemError = true
          if (!firstFailedTableLabel) {
            firstFailedTableLabel = tablesSer.add[ev.index]?.label ?? null
          }
        }
      }
    } finally {
      setIsSubmitting(false)
      setProgress('idle')
    }

    if (failedMsg) {
      setError(failedMsg)
      return { ok: false, error: failedMsg }
    }

    if (!resolvedMarketId) {
      const msg = 'Något gick fel.'
      setError(msg)
      return { ok: false, error: msg }
    }

    if (mode === 'create' && anyItemError && firstFailedTableLabel) {
      const msg = `Kunde inte skapa bord "${firstFailedTableLabel}". Loppisen publicerades men vissa bord sparades inte.`
      setError(msg)
      return { ok: true, marketId: resolvedMarketId }
    }
    if (mode === 'create' && anyItemError) {
      const msg = 'Kunde inte ladda upp alla bilder. Loppisen publicerades men vissa bilder sparades inte.'
      setError(msg)
      return { ok: true, marketId: resolvedMarketId }
    }
    if (mode === 'edit' && anyItemError) {
      const msg = 'Vissa ändringar kunde inte sparas. Kontrollera och försök igen.'
      setError(msg)
      return { ok: true, marketId: resolvedMarketId }
    }

    if (mode === 'edit') {
      setSuccess('Loppisen har uppdaterats!')
    }

    onSuccess?.(resolvedMarketId)
    return { ok: true, marketId: resolvedMarketId }
  }, []) // stable — reads from optsRef.current at call time

  const clearError = useCallback(() => setError(null), [])
  const clearSuccess = useCallback(() => setSuccess(null), [])

  return {
    submit,
    state: { isSubmitting, progress, imageStatuses, error, success },
    clearError,
    clearSuccess,
  }
}
