'use client'

/**
 * Lazy-loaded wrapper for TrailBackground.
 * Deferred via dynamic import (ssr: false) so the decorative SVG does not
 * add to the initial HTML payload or block hydration of meaningful content.
 */
import dynamic from 'next/dynamic'

export const TrailBackgroundLazy = dynamic(
  () => import('./trail-background').then((m) => m.TrailBackground),
  { ssr: false },
)
