'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api, geo } from '@/lib/api'
import type { FleaMarketNearBy } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { checkOpeningHours, type OpeningHoursEntry, type Stop } from '@fyndstigen/shared'
import { FyndstigenLogo } from './fyndstigen-logo'

// Marker icons
const defaultMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23998A7A"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`
const activeMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/><text x="14" y="17" text-anchor="middle" font-size="11" font-weight="bold" fill="%23C45B35" font-family="sans-serif">%NUM%</text></svg>`

const defaultIcon = new L.Icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(defaultMarkerSvg)}`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -36],
})

function numberedIcon(num: number) {
  const svg = activeMarkerSvg.replace('%NUM%', String(num))
  return new L.Icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  })
}

type MarketWithHours = FleaMarketNearBy & {
  openingHours?: OpeningHoursEntry[]
}

type RouteStop = {
  market: MarketWithHours
  index: number
}

export default function RouteBuilder() {
  const router = useRouter()
  const { user } = useAuth()

  const [markets, setMarkets] = useState<MarketWithHours[]>([])
  const [stops, setStops] = useState<RouteStop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [name, setName] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [useGps, setUseGps] = useState(true)
  const [customStart, setCustomStart] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // Load markets
  useEffect(() => {
    geo.nearbyMarkets({ lat: 59.27, lng: 15.21 }, 60)
      .then((data) => setMarkets(data ?? []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [])

  // Get user GPS
  useEffect(() => {
    if (useGps && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
      )
    }
  }, [useGps])

  const isInRoute = useCallback(
    (marketId: string) => stops.some((s) => s.market.id === marketId),
    [stops],
  )

  function toggleMarket(market: MarketWithHours) {
    if (isInRoute(market.id)) {
      setStops((prev) => prev.filter((s) => s.market.id !== market.id))
    } else {
      setStops((prev) => [
        ...prev,
        { market, index: prev.length },
      ])
    }
  }

  function removeStop(marketId: string) {
    setStops((prev) => prev.filter((s) => s.market.id !== marketId))
  }

  function handleOptimize() {
    if (stops.length < 2) return
    const asStops: Stop[] = stops.map((s) => ({
      id: s.market.id,
      lat: s.market.latitude,
      lng: s.market.longitude,
    }))
    const startPoint =
      !useGps && customStart
        ? customStart
        : userPos
          ? userPos
          : undefined
    const optimized = geo.optimizeStops(asStops, startPoint)
    setStops(
      optimized.map((opt, i) => ({
        market: stops.find((s) => s.market.id === opt.id)!.market,
        index: i,
      })),
    )
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newStops = [...stops]
    const [moved] = newStops.splice(dragIdx, 1)
    newStops.splice(idx, 0, moved)
    setStops(newStops)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  async function handleSave() {
    if (!user || !name.trim() || stops.length === 0) return
    setSaving(true)
    try {
      const startLat = !useGps && customStart ? customStart.lat : userPos?.lat
      const startLng = !useGps && customStart ? customStart.lng : userPos?.lng

      const { id } = await api.routes.create({
        name: name.trim(),
        createdBy: user.id,
        startLatitude: startLat,
        startLongitude: startLng,
        plannedDate: plannedDate || undefined,
        stops: stops.map((s) => ({ fleaMarketId: s.market.id })),
      })
      router.push(`/rundor/${id}`)
    } catch {
      setSaveError('Kunde inte spara rundan. Försök igen.')
    } finally {
      setSaving(false)
    }
  }

  // Polyline coordinates
  const polylinePositions: [number, number][] = stops.map((s) => [
    s.market.latitude,
    s.market.longitude,
  ])

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Sidebar */}
      <div className="w-full lg:w-[400px] bg-card border-r border-cream-warm overflow-y-auto shrink-0 order-2 lg:order-1">
        <div className="p-6">
          {/* Header */}
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-sm text-espresso/60 hover:text-espresso transition-colors mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Tillbaka
          </Link>

          <h1 className="font-display text-2xl font-bold">Skapa loppisrunda</h1>
          <p className="text-sm text-espresso/65 mt-1">
            Klicka på loppisar i kartan eller sök nedan.
          </p>

          {/* Route name */}
          <div className="mt-6">
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Namn på rundan
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="T.ex. Söndagsrundan Södermalm"
              className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25"
            />
          </div>

          {/* Planned date */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Planerat datum (valfritt)
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full h-11 rounded-xl bg-parchment px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all"
            />
          </div>

          {/* Start point toggle */}
          <div className="mt-4">
            <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
              Startpunkt
            </label>
            <div className="flex gap-1 bg-cream-warm rounded-xl p-1">
              <button
                onClick={() => setUseGps(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${useGps ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
              >
                Min position (GPS)
              </button>
              <button
                onClick={() => setUseGps(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${!useGps ? 'bg-card text-espresso shadow-sm' : 'text-espresso/60'}`}
              >
                Välj på kartan
              </button>
            </div>
          </div>

          {/* Stops list */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold">
                Stopp ({stops.length})
              </h2>
              {stops.length >= 2 && (
                <button
                  onClick={handleOptimize}
                  className="text-xs font-semibold text-rust hover:text-rust-light transition-colors"
                >
                  Optimera rutt
                </button>
              )}
            </div>

            {stops.length === 0 ? (
              <div className="text-center py-8">
                <FyndstigenLogo
                  size={36}
                  className="text-espresso/10 mx-auto mb-2"
                />
                <p className="text-xs text-espresso/30">
                  Klicka på en markör i kartan för att lägga till stopp.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stops.map((stop, i) => {
                  const oh = plannedDate
                    ? checkOpeningHours(
                        (stop.market.openingHours ?? []) as OpeningHoursEntry[],
                        plannedDate,
                      )
                    : null

                  return (
                    <div
                      key={stop.market.id}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 bg-parchment rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all ${dragIdx === i ? 'opacity-50 scale-95' : ''}`}
                    >
                      {/* Number badge */}
                      <div className="w-7 h-7 rounded-full bg-rust text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {stop.market.name}
                        </p>
                        <p className="text-xs text-espresso/60 truncate">
                          {stop.market.city}
                        </p>
                      </div>

                      {/* Opening hours warning */}
                      {oh && !oh.isOpen && (
                        <span
                          className="text-error text-xs font-medium shrink-0"
                          title="Stängt denna dag"
                        >
                          Stängt
                        </span>
                      )}
                      {oh && oh.isOpen && oh.hours && (
                        <span className="text-forest text-xs font-medium shrink-0 tabular-nums">
                          {oh.hours.open_time}–{oh.hours.close_time}
                        </span>
                      )}

                      {/* Remove button */}
                      <button
                        onClick={() => removeStop(stop.market.id)}
                        className="text-espresso/20 hover:text-error transition-colors shrink-0"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M4 4L10 10M10 4L4 10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Save button */}
          {saveError && (
            <div className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-4 py-3 mt-4">
              {saveError}
            </div>
          )}
          {user ? (
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || stops.length === 0}
              className="w-full h-12 rounded-xl bg-rust text-white font-semibold text-sm hover:bg-rust-light transition-colors disabled:opacity-40 mt-6 shadow-sm"
            >
              {saving ? 'Sparar...' : 'Spara loppisrunda'}
            </button>
          ) : (
            <div className="mt-6 vintage-card p-4 text-center">
              <p className="text-sm text-espresso/65">
                <Link href="/auth" className="text-rust font-semibold">
                  Logga in
                </Link>{' '}
                för att spara din runda.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative order-1 lg:order-2 min-h-[300px] lg:min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-parchment/50">
            <FyndstigenLogo size={40} className="text-rust animate-bob" />
          </div>
        )}
        <MapContainer
          center={[59.27, 15.21]}
          zoom={11}
          className="h-full w-full"
          style={{ minHeight: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Custom start point click handler */}
          {!useGps && <MapClickHandler onMapClick={setCustomStart} />}

          {/* Custom start marker */}
          {!useGps && customStart && (
            <Marker
              position={[customStart.lat, customStart.lng]}
              icon={
                new L.Icon({
                  iconUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="%235B7352" stroke="white" stroke-width="2"/></svg>`)}`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })
              }
            >
              <Popup>
                <span className="text-sm font-medium">Startpunkt</span>
              </Popup>
            </Marker>
          )}

          {/* Market markers */}
          {markets.map((market) => {
            const stopIndex = stops.findIndex(
              (s) => s.market.id === market.id,
            )
            const inRoute = stopIndex >= 0

            return (
              <Marker
                key={market.id}
                position={[market.latitude, market.longitude]}
                icon={inRoute ? numberedIcon(stopIndex + 1) : defaultIcon}
                eventHandlers={{
                  click: () => toggleMarket(market),
                }}
              >
                <Popup>
                  <div className="min-w-[180px] p-1">
                    <p className="font-display font-bold text-sm">
                      {market.name}
                    </p>
                    <p className="text-xs text-espresso/65 mt-1">
                      {market.city}
                    </p>
                    <button
                      onClick={() => toggleMarket(market)}
                      className={`mt-2 text-xs font-semibold ${inRoute ? 'text-error' : 'text-rust'}`}
                    >
                      {inRoute ? 'Ta bort från rundan' : 'Lägg till i rundan'}
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Route polyline */}
          {polylinePositions.length >= 2 && (
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: '#C45B35',
                weight: 3,
                opacity: 0.7,
                dashArray: '8, 8',
              }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  )
}

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (pos: { lat: number; lng: number }) => void
}) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}
