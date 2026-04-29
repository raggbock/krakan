'use client'

import dynamic from 'next/dynamic'

// `ssr: false` must live in a Client Component (Next.js 15 restriction).
// The server-component /map page imports this wrapper instead of map-view
// directly, keeping the Leaflet bundle out of the SSR pass.
const MapView = dynamic(() => import('@/components/map-view'), { ssr: false })

export default function MapViewClient() {
  return <MapView />
}
