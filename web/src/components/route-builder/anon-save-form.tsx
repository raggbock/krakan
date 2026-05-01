'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'
import { endpoints } from '@/lib/edge'
import type { RouteBuilderStop } from './stop-list'

type Props = {
  stops: RouteBuilderStop[]
  name: string
  plannedDate: string
  useGps: boolean
  customStart: { lat: number; lng: number } | null
  userPos: { lat: number; lng: number } | null
  onSaved: () => void
}

const ERROR_LABEL: Record<string, string> = {
  too_many_saves: 'Du har sparat för många rundor idag. Prova igen imorgon.',
}

function labelFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return ERROR_LABEL[msg] ?? 'Något gick fel. Försök igen om en stund.'
}

export function AnonSaveForm({
  stops,
  name,
  plannedDate,
  useGps,
  customStart,
  userPos,
  onSaved,
}: Props) {
  const router = useRouter()
  const posthog = usePostHog()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || stops.length === 0) return

    posthog?.capture('route_anon_save_attempted', { stop_count: stops.length })
    setPending(true)
    setError('')

    const startLatitude =
      !useGps && customStart ? customStart.lat : userPos?.lat
    const startLongitude =
      !useGps && customStart ? customStart.lng : userPos?.lng

    try {
      const result = await endpoints['route.create-anon'].invoke({
        name: name.trim() || 'Min loppisrunda',
        email: email.trim().toLowerCase(),
        plannedDate: plannedDate || undefined,
        startLatitude,
        startLongitude,
        marketIds: stops.map((s) => s.market.id),
      })
      posthog?.capture('route_anon_save_succeeded', {
        route_id: result.routeId,
        stop_count: stops.length,
      })
      onSaved()
      router.push(
        `/rundor/skapa/tack?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      )
    } catch (err) {
      posthog?.capture('route_anon_save_failed', {
        stop_count: stops.length,
        reason: err instanceof Error ? err.message : 'unknown',
      })
      setError(labelFor(err))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="din@epost.se"
        className="w-full px-3.5 py-2.5 rounded-input border border-cream-warm bg-parchment text-espresso font-medium text-sm focus:outline-none focus:border-forest"
      />
      <button
        type="submit"
        disabled={pending || !email.trim()}
        className="w-full bg-rust text-white px-5 py-2.5 rounded-pill font-bold text-sm disabled:opacity-50 hover:bg-rust/90 transition-colors"
      >
        {pending ? 'Sparar…' : 'Spara via mail'}
      </button>
      {error && <p className="text-error text-xs text-center">{error}</p>}
    </form>
  )
}
