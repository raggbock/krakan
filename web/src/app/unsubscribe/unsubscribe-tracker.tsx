'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

/**
 * Fires a PostHog `digest_unsubscribed` event on mount when the unsubscribe
 * was successful. Rendered only by the server-side unsubscribe page.
 */
export function UnsubscribeTracker() {
  const posthog = usePostHog()

  useEffect(() => {
    posthog?.capture('digest_unsubscribed', { method: 'email_link' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
