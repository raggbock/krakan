'use client'

import type { Dispatch, SetStateAction } from 'react'
import { OpeningHoursEditor } from '@/components/opening-hours-editor'
import type { RuleDraft, ExceptionDraft } from '@fyndstigen/shared'

export type OpeningHoursSectionProps = {
  rules: RuleDraft[]
  setRules: Dispatch<SetStateAction<RuleDraft[]>>
  exceptions: ExceptionDraft[]
  setExceptions: Dispatch<SetStateAction<ExceptionDraft[]>>
  /** When true, renders with the scroll-anchor id (needed for edit page Gömd CTA). */
  withScrollAnchor?: boolean
  /**
   * 'card' (default) — wraps editor in a vintage-card section with a heading.
   * 'bare'            — renders editor directly with no card wrapper (create page step 1).
   */
  variant?: 'card' | 'bare'
}

export function OpeningHoursSection({
  rules,
  setRules,
  exceptions,
  setExceptions,
  withScrollAnchor = false,
  variant = 'card',
}: OpeningHoursSectionProps) {
  const editor = (
    <OpeningHoursEditor
      rules={rules}
      setRules={setRules}
      exceptions={exceptions}
      setExceptions={setExceptions}
    />
  )

  if (variant === 'bare') {
    return editor
  }

  return (
    <section
      id={withScrollAnchor ? 'opening-hours' : undefined}
      className={`vintage-card p-6 animate-fade-up delay-1${withScrollAnchor ? ' scroll-mt-20' : ''}`}
    >
      <h2 className="font-display font-bold text-lg mb-4">Öppettider</h2>
      {editor}
    </section>
  )
}
