'use client'

import { useEffect, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'

/**
 * Fires `notification_clicked { source: 'email' }` when the page is loaded
 * with a `?nc=1` query parameter (appended by the notification digest email).
 * Strips the param after firing to keep URLs clean.
 */
export function TrackCityEmailClick() {
  const posthog = usePostHog()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('nc') === '1') {
      fired.current = true
      posthog?.capture('notification_clicked', { source: 'email' })
      params.delete('nc')
      const qs = params.toString()
      const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
      window.history.replaceState(null, '', cleanUrl)
    }
  }, [posthog])

  return null
}
