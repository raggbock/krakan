'use client'

import { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react'
import type { RuleDraft, ExceptionDraft } from '@fyndstigen/shared'

export type { RuleDraft, ExceptionDraft }

export type OpeningHoursDraftResult = {
  rules: RuleDraft[]
  exceptions: ExceptionDraft[]
  addRule: (rule: RuleDraft) => void
  updateRule: (index: number, rule: RuleDraft) => void
  removeRule: (index: number) => void
  /** Direct useState setter — compatible with OpeningHoursEditor's Dispatch<SetStateAction<...>> prop */
  setRules: Dispatch<SetStateAction<RuleDraft[]>>
  addException: (ex: ExceptionDraft) => void
  removeException: (index: number) => void
  /** Direct useState setter — compatible with OpeningHoursEditor's Dispatch<SetStateAction<...>> prop */
  setExceptions: Dispatch<SetStateAction<ExceptionDraft[]>>
  reset: (rules: RuleDraft[], exceptions: ExceptionDraft[]) => void
  serialize: () => { rules: RuleDraft[]; exceptions: ExceptionDraft[] }
}

export function useOpeningHoursDraft(
  initialRules: RuleDraft[] = [],
  initialExceptions: ExceptionDraft[] = [],
): OpeningHoursDraftResult {
  const [rules, setRules] = useState<RuleDraft[]>(initialRules)
  const [exceptions, setExceptions] = useState<ExceptionDraft[]>(initialExceptions)

  const addRule = useCallback((rule: RuleDraft) => {
    setRules((prev) => [...prev, rule])
  }, [])

  const updateRule = useCallback((index: number, rule: RuleDraft) => {
    setRules((prev) => prev.map((r, i) => (i === index ? rule : r)))
  }, [])

  const removeRule = useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const addException = useCallback((ex: ExceptionDraft) => {
    setExceptions((prev) => [...prev, ex])
  }, [])

  const removeException = useCallback((index: number) => {
    setExceptions((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const reset = useCallback((nextRules: RuleDraft[], nextExceptions: ExceptionDraft[]) => {
    setRules(nextRules)
    setExceptions(nextExceptions)
  }, [])

  const serialize = useCallback(() => ({ rules, exceptions }), [rules, exceptions])

  return useMemo(
    () => ({
      rules,
      exceptions,
      addRule,
      updateRule,
      removeRule,
      setRules,
      addException,
      removeException,
      setExceptions,
      reset,
      serialize,
    }),
    [rules, exceptions, addRule, updateRule, removeRule, addException, removeException, reset, serialize],
  )
}
