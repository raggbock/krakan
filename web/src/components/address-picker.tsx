'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="%23C45B35"/><circle cx="14" cy="13" r="5" fill="%23F2EBE0"/></svg>`

const icon = new L.Icon({
  iconUrl: `data:image/svg+xml,${encodeURIComponent(markerSvg)}`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
})

export type AddressValue = {
  street: string
  zipCode: string
  city: string
  latitude: number | null
  longitude: number | null
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
  address?: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
  }
}

type Props = {
  value: AddressValue
  onChange: (value: AddressValue) => void
  /** Tailwind class for the input bg, e.g. "bg-card" or "bg-parchment" */
  inputBg?: string
}

const DEFAULT_CENTER: [number, number] = [59.33, 18.07]

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const prev = useRef<string>('')
  useEffect(() => {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (key !== prev.current) {
      prev.current = key
      map.flyTo([lat, lng], 15, { duration: 0.8 })
    }
  }, [map, lat, lng])
  return null
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapCleanup() {
  const map = useMap()
  useEffect(() => {
    return () => {
      map.remove()
    }
  }, [map])
  return null
}

export default function AddressPicker({ value, onChange, inputBg = 'bg-card' }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const searchNominatim = useCallback(async (q: string) => {
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=se&limit=5`,
        { headers: { 'User-Agent': 'Fyndstigen/0.1' } },
      )
      const data: NominatimResult[] = await res.json()
      setSuggestions(data)
      setShowSuggestions(data.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchNominatim(q), 350)
  }

  function selectSuggestion(result: NominatimResult) {
    const addr = result.address
    const street = addr
      ? [addr.road, addr.house_number].filter(Boolean).join(' ')
      : ''
    const city = addr?.city || addr?.town || addr?.village || addr?.municipality || ''
    const zipCode = addr?.postcode || ''

    onChange({
      street: street || value.street,
      zipCode: zipCode || value.zipCode,
      city: city || value.city,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    })
    setQuery('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  async function handleMapClick(lat: number, lng: number) {
    onChange({ ...value, latitude: lat, longitude: lng })

    // Reverse geocode
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'Fyndstigen/0.1' } },
      )
      const data: NominatimResult = await res.json()
      const addr = data.address
      if (addr) {
        const street = [addr.road, addr.house_number].filter(Boolean).join(' ')
        const city = addr.city || addr.town || addr.village || addr.municipality || ''
        const zipCode = addr.postcode || ''
        onChange({
          street: street || value.street,
          zipCode: zipCode || value.zipCode,
          city: city || value.city,
          latitude: lat,
          longitude: lng,
        })
      }
    } catch {
      // Keep coordinates even if reverse geocode fails
    }
  }

  const mapCenter: [number, number] =
    value.latitude && value.longitude
      ? [value.latitude, value.longitude]
      : DEFAULT_CENTER

  return (
    <div className="space-y-4">
      {/* Search / autofill */}
      <div ref={wrapperRef} className="relative">
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Sök adress
        </label>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Sök gata, stad eller plats..."
            className={`w-full h-11 rounded-xl ${inputBg} px-4 pr-10 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25`}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-rust/30 border-t-rust rounded-full animate-spin" />
            </div>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-cream-warm rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectSuggestion(s)}
                className="w-full text-left px-4 py-3 text-sm hover:bg-cream-warm transition-colors border-b border-cream-warm/50 last:border-0"
              >
                <span className="line-clamp-1">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual address fields */}
      <div>
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Gatuadress *
        </label>
        <input
          type="text"
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Storgatan 1"
          className={`w-full h-11 rounded-xl ${inputBg} px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
            Postnummer
          </label>
          <input
            type="text"
            value={value.zipCode}
            onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
            placeholder="702 11"
            className={`w-full h-11 rounded-xl ${inputBg} px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25`}
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
            Stad *
          </label>
          <input
            type="text"
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="Örebro"
            className={`w-full h-11 rounded-xl ${inputBg} px-4 text-sm border border-cream-warm outline-none focus:border-rust/40 transition-all placeholder:text-espresso/25`}
          />
        </div>
      </div>

      {/* Mini map */}
      <div>
        <label className="text-sm font-semibold text-espresso/70 block mb-1.5">
          Placering på karta
          <span className="font-normal text-espresso/40 ml-1.5">klicka för att flytta</span>
        </label>
        <div className="h-[240px] rounded-xl overflow-hidden border border-cream-warm">
          <MapContainer
            center={mapCenter}
            zoom={value.latitude ? 15 : 5}
            className="w-full h-full"
            style={{ minHeight: '240px' }}
          >
            <MapCleanup />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onClick={handleMapClick} />
            {value.latitude && value.longitude && (
              <>
                <FlyTo lat={value.latitude} lng={value.longitude} />
                <Marker position={[value.latitude, value.longitude]} icon={icon} />
              </>
            )}
          </MapContainer>
        </div>
        {value.latitude && value.longitude && (
          <p className="text-xs text-espresso/40 mt-1.5 tabular-nums">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  )
}
