'use client'

import { useState } from 'react'
import { api } from '@/lib/api'

type TableDraft = {
  label: string
  description: string
  priceSek: number
  sizeDescription: string
}

export type CreateMarketInput = {
  name: string
  description: string
  street: string
  zipCode: string
  city: string
  isPermanent: boolean
  organizerId: string
  tables: TableDraft[]
  images: File[]
}

type Progress = 'idle' | 'geocoding' | 'creating' | 'tables' | 'images' | 'publishing'

export function useCreateMarket() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress>('idle')

  async function submit(input: CreateMarketInput): Promise<{ id: string } | null> {
    setIsSubmitting(true)
    setError(null)
    setProgress('geocoding')

    try {
      // Geocode address
      let latitude = 59.33
      let longitude = 18.07
      try {
        const q = encodeURIComponent(
          `${input.street.trim()}, ${input.zipCode.trim()} ${input.city.trim()}, Sweden`,
        )
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
          { headers: { 'User-Agent': 'Fyndstigen/0.1' }, signal: controller.signal },
        )
        clearTimeout(timeout)
        const results = await res.json()
        if (results.length > 0) {
          latitude = parseFloat(results[0].lat)
          longitude = parseFloat(results[0].lon)
        }
      } catch {
        // Fallback to Stockholm coordinates
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
        openingHours: [],
      })

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
          setError(`Kunde inte skapa bord "${table.label}". Loppisen sparades som utkast.`)
          return { id }
        }
      }

      // Upload images
      setProgress('images')
      for (const file of input.images) {
        try {
          await api.images.upload(id, file)
        } catch {
          setError('Kunde inte ladda upp alla bilder. Loppisen sparades som utkast.')
          return { id }
        }
      }

      // Publish
      setProgress('publishing')
      await api.fleaMarkets.publish(id)

      return { id }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
      return null
    } finally {
      setIsSubmitting(false)
      setProgress('idle')
    }
  }

  return { submit, isSubmitting, error, progress }
}
