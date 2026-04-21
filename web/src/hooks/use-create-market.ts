'use client'

import { useState } from 'react'
import { api, geo } from '@/lib/api'
import { GeocodeError } from '@fyndstigen/shared'

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

export function useCreateMarket() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>('idle')
  const [imageStatuses, setImageStatuses] = useState<ImageUploadStatus[]>([])

  async function submit(input: CreateMarketInput): Promise<{ id: string } | null> {
    setIsSubmitting(true)
    setError(null)
    setProgress('geocoding')
    setImageStatuses(
      input.images.map((f) => ({ name: f.name, state: 'pending' as const })),
    )

    try {
      // Use pre-computed coordinates from map picker, or fall back to geocoding
      let latitude: number
      let longitude: number
      if (input.coordinates) {
        latitude = input.coordinates.latitude
        longitude = input.coordinates.longitude
      } else {
        const coords = await geo.geocode(
          `${input.street.trim()}, ${input.zipCode.trim()} ${input.city.trim()}, Sweden`,
        )
        latitude = coords.lat
        longitude = coords.lng
      }

      // Create market
      setProgress('creating')
      const { id } = await api.fleaMarkets.create({
        name: input.name.trim(),
        description: input.description.trim(),
        address: {
          street: input.street.trim(),
          zipCode: input.zipCode.trim(),
          city: input.city.trim(),
          country: 'Sweden',
          location: { latitude, longitude },
        },
        isPermanent: input.isPermanent,
        organizerId: input.organizerId,
        autoAcceptBookings: input.autoAcceptBookings,
        openingHours: input.openingHours,
        openingHourExceptions: input.openingHourExceptions,
      })

      // Publish first so the market is visible on the map
      setProgress('publishing')
      await api.fleaMarkets.publish(id)

      // Create tables
      setProgress('tables')
      for (const table of input.tables) {
        try {
          await api.marketTables.create({
            fleaMarketId: id,
            label: table.label,
            description: table.description || undefined,
            priceSek: table.priceSek,
            sizeDescription: table.sizeDescription || undefined,
          })
        } catch {
          setError(`Kunde inte skapa bord "${table.label}". Loppisen publicerades men vissa bord sparades inte.`)
          return { id }
        }
      }

      // Upload images
      setProgress('images')
      let anyImageFailed = false
      for (let i = 0; i < input.images.length; i++) {
        setImageStatuses((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, state: 'uploading' } : s)),
        )
        try {
          await api.images.add(id, input.images[i])
          setImageStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, state: 'done' } : s)),
          )
        } catch {
          setImageStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, state: 'error' } : s)),
          )
          anyImageFailed = true
        }
      }
      if (anyImageFailed) {
        setError('Kunde inte ladda upp alla bilder. Loppisen publicerades men vissa bilder sparades inte.')
        return { id }
      }

      return { id }
    } catch (err) {
      if (err instanceof GeocodeError) {
        setError('Kunde inte hitta adressen. Välj plats på kartan istället.')
      } else {
        setError(err instanceof Error ? err.message : 'Något gick fel')
      }
      return null
    } finally {
      setIsSubmitting(false)
      setProgress('idle')
    }
  }

  return { submit, isSubmitting, error, progress, imageStatuses }
}
