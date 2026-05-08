'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getConsentStatus } from '@/components/cookie-consent'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key || !host) return

    // Only initialize PostHog if user has accepted cookies
    if (getConsentStatus() !== 'accepted') return

    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false, // we handle this manually below
      capture_pageleave: true,
      disable_session_recording: true, // start lazily after pageload to avoid blocking first paint
    })

    // Defer session recording until the browser is idle (or after 2 s on
    // browsers that don't support requestIdleCallback, e.g. older Safari).
    // This prevents the rrweb snapshot from blocking first interaction.
    //
    // TODO(perf/posthog-recorder): Bundle analysis (2026-05-02) attributed
    // ~538 KB (uncompressed) to a combined posthog+Sentry chunk and suggested
    // switching to CDN-loaded recorder.  Investigation shows posthog-js@1.367
    // already loads the rrweb recorder from CDN via loadExternalDependency()
    // rather than bundling it in dist/module.js (only 178 KB minified, with 3
    // rrweb refs that are purely external-extension checks).  The 538 KB chunk
    // is posthog uncompressed (~400 KB) + Sentry (~56 KB) combined by Turbopack.
    // Switching to posthog-js/dist/module.slim.js would save ~86 KB but requires
    // verifying that all used features (session recording, autocapture) are
    // preserved.  Skipping for now — the main rrweb recorder is already CDN-loaded.
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => posthog.startSessionRecording())
    } else {
      setTimeout(() => posthog.startSessionRecording(), 2000)
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (pathname && ph) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString()
      }
      ph.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams, ph])

  return null
}
