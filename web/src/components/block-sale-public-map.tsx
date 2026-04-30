'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

type Stand = {
  id: string
  street: string
  city: string
  description: string
  latitude: number | null
  longitude: number | null
}

type Props = {
  stands: Stand[]
  center: { lat: number; lng: number } | null
  onSelect: (id: string) => void
}

// Dynamic import to keep Leaflet out of the SSR pass
const BlockSaleMapInner = dynamic(() => import('./block-sale-map-inner'), { ssr: false })

export function BlockSalePublicMap(props: Props) {
  if (props.stands.length === 0) {
    return (
      <div className="bg-parchment-light border border-cream-warm rounded-card p-8 text-center text-espresso/60">
        <p className="font-medium">Inga godkända stånd ännu.</p>
        <p className="text-sm mt-1">Ansök nedan för att bli ett av de första stånden!</p>
      </div>
    )
  }

  const pinned = props.stands.filter((s) => s.latitude !== null && s.longitude !== null)

  // If none of the approved stands have coordinates yet, fall back to list
  if (pinned.length === 0) {
    return <StandList stands={props.stands} onSelect={props.onSelect} />
  }

  return (
    <section aria-label="Godkända stånd">
      <h2 className="font-display text-xl font-semibold mb-3">
        Godkända stånd ({props.stands.length})
      </h2>
      <BlockSaleMapInner {...props} />
    </section>
  )
}

function StandList({ stands, onSelect }: { stands: Stand[]; onSelect: (id: string) => void }) {
  return (
    <section aria-label="Godkända stånd">
      <h2 className="font-display text-xl font-semibold mb-3">Godkända stånd ({stands.length})</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {stands.map((stand) => (
          <li key={stand.id}>
            <button
              onClick={() => onSelect(stand.id)}
              className="w-full text-left bg-card border border-cream-warm rounded-card px-4 py-3 hover:border-forest/40 hover:bg-parchment-light transition-colors group"
            >
              <p className="font-semibold text-espresso group-hover:text-forest transition-colors">
                {stand.street}
              </p>
              {stand.description && (
                <p className="text-espresso/65 text-sm mt-0.5 line-clamp-2">{stand.description}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
