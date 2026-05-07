'use client'

import { useEffect, useRef, useState } from 'react'
import type { LatLng } from '@fyndstigen/shared'

/**
 * Watches the `useGps` flag and fires `getCurrentPosition` only on the
 * `false → true` edge (including the initial mount when useGps starts true).
 */
export function useGpsReader(
  useGps: boolean,
  geolocation: Geolocation | undefined,
): { userPos: LatLng | null; gpsError: string | null } {
  const [userPos, setUserPos] = useState<LatLng | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const prevUseGpsRef = useRef<boolean | null>(null)

  useEffect(() => {
    const wasGps = prevUseGpsRef.current
    prevUseGpsRef.current = useGps

    // Fire only on false → true edge (including initial mount where prev is null)
    const risingEdge = useGps && (wasGps === null || wasGps === false)
    if (!risingEdge) return
    if (!geolocation) return

    geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsError(null)
      },
      () => {
        setGpsError('GPS ej tillgänglig — kontrollera behörigheter.')
      },
    )
  }, [useGps, geolocation])

  return { userPos, gpsError }
}
