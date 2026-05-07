'use client'
import { useReportWebVitals } from 'next/web-vitals'
import { usePostHog } from 'posthog-js/react'

/**
 * Captures Core Web Vitals (LCP, CLS, INP, TTFB, FCP) as PostHog events so
 * we can track real-user performance over time and per route.
 *
 * Mount once inside the PostHogProvider tree (layout.tsx). Returns null —
 * purely a side-effect component.
 */
export function WebVitalsReporter() {
  const posthog = usePostHog()
  useReportWebVitals((metric) => {
    posthog?.capture('web_vital', {
      name: metric.name, // 'CLS' | 'LCP' | 'INP' | 'TTFB' | 'FCP'
      value: metric.value,
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      delta: metric.delta,
      id: metric.id,
      navigation_type: metric.navigationType,
      // $pathname is captured automatically by PostHog
    })
  })
  return null
}
