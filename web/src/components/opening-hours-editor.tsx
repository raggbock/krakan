'use client'

import { useEffect, useRef, useState } from 'react'
import type { RuleDraft, ExceptionDraft } from '@/hooks/use-create-market'

export const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

type OpeningHoursEditorProps = {
  rules: RuleDraft[]
  setRules: React.Dispatch<React.SetStateAction<RuleDraft[]>>
  exceptions: ExceptionDraft[]
  setExceptions: React.Dispatch<React.SetStateAction<ExceptionDraft[]>>
}

export function OpeningHoursEditor({
  rules,
  setRules,
  exceptions,
  setExceptions,
}: OpeningHoursEditorProps) {
  const [ruleType, setRuleType] = useState<'weekly' | 'biweekly' | 'date'>('weekly')
  const [ohDays, setOhDays] = useState<number[]>([])
  const [ohDaysOpen, setOhDaysOpen] = useState(false)
  const ohDaysRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ohDaysOpen) return
    function handleClick(e: MouseEvent) {
      if (ohDaysRef.current && !ohDaysRef.current.contains(e.target as Node)) {
        setOhDaysOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ohDaysOpen])

  const [ohAnchorDate, setOhAnchorDate] = useState('')
  const [ohOpen, setOhOpen] = useState('10:00')
  const [ohClose, setOhClose] = useState('16:00')
  const [showExceptionForm, setShowExceptionForm] = useState(false)
  const [exDate, setExDate] = useState('')
  const [exReason, setExReason] = useState('')
  const [overlapWarning, setOverlapWarning] = useState('')

  const canAddRule =
    ohOpen && ohClose && ohOpen < ohClose &&
    (ruleType === 'date' ? !!ohAnchorDate : ohDays.length > 0) &&
    (ruleType === 'biweekly' ? !!ohAnchorDate : true)

  function toggleDay(day: number) {
    setOhDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function isDuplicate(prev: RuleDraft[], r: RuleDraft) {
    return prev.some(
      (p) => p.type === r.type && p.dayOfWeek === r.dayOfWeek &&
        p.anchorDate === r.anchorDate && p.openTime === r.openTime && p.closeTime === r.closeTime,
    )
  }

  function overlaps(a: { openTime: string; closeTime: string }, b: { openTime: string; closeTime: string }) {
    return a.openTime < b.closeTime && b.openTime < a.closeTime
  }

  function hasOverlap(prev: RuleDraft[], r: RuleDraft) {
    return prev.some((p) => {
      if (p.type !== r.type) return false
      if (r.type === 'date') return p.anchorDate === r.anchorDate && overlaps(p, r)
      return p.dayOfWeek === r.dayOfWeek && p.anchorDate === r.anchorDate && overlaps(p, r)
    })
  }

  function addRule() {
    if (!canAddRule) return
    setOverlapWarning('')
    if (ruleType === 'date') {
      const rule = { type: ruleType, dayOfWeek: null, anchorDate: ohAnchorDate || null, openTime: ohOpen, closeTime: ohClose } as RuleDraft
      if (isDuplicate(rules, rule)) return
      if (hasOverlap(rules, rule)) { setOverlapWarning('Tiderna överlappar med en befintlig tid'); return }
      setRules((prev) => [...prev, rule])
    } else {
      const newRules = ohDays.map((day) => ({
        type: ruleType,
        dayOfWeek: day,
        anchorDate: ohAnchorDate || null,
        openTime: ohOpen,
        closeTime: ohClose,
      }))
      const unique = newRules.filter((r) => !isDuplicate(rules, r))
      const overlapping = unique.filter((r) => hasOverlap(rules, r))
      if (overlapping.length > 0) {
        const days = overlapping.map((r) => DAY_NAMES[r.dayOfWeek!]).join(', ')
        setOverlapWarning(`Tiderna överlappar på ${days}`)
        return
      }
      if (unique.length > 0) setRules((prev) => [...prev, ...unique])
    }
    setOhDays([])
    setOhAnchorDate('')
  }

  function formatRuleLabel(r: RuleDraft): string {
    if (r.type === 'weekly') return `Varje ${DAY_NAMES[r.dayOfWeek!]?.toLowerCase()}`
    if (r.type === 'biweekly') {
      const anchor = r.anchorDate
        ? ` från ${new Date(r.anchorDate + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
        : ''
      return `Varannan ${DAY_NAMES[r.dayOfWeek!]?.toLowerCase()}${anchor}`
    }
    return new Date(r.anchorDate + 'T12:00:00').toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <>
      {/* Rules list */}
      {rules.length > 0 && (
        <div className="space-y-2 mb-4">
          {rules.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-parchment rounded-xl px-4 py-3"
            >
              <span className="text-sm">{formatRuleLabel(r)}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">
                  {r.openTime} &ndash; {r.closeTime}
                </span>
                <button
                  type="button"
                  onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
                  className="text-espresso/20 hover:text-error transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 bg-parchment rounded-xl p-4">
        {/* Step 1: Type selector */}
        <div>
          <label className="text-xs font-semibold text-espresso/60 block mb-2">
            Typ av öppettid
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'weekly' as const, label: 'Varje vecka' },
              { value: 'biweekly' as const, label: 'Varannan vecka' },
              { value: 'date' as const, label: 'Specifikt datum' },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setRuleType(opt.value); setOhDays([]); setOhDaysOpen(false); setOhAnchorDate('') }}
                className={`py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                  ruleType === opt.value
                    ? 'bg-card text-espresso border-rust/40 shadow-sm'
                    : 'bg-card/50 text-espresso/50 border-cream-warm hover:border-espresso/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Details (varies by type) */}
        <div className="grid grid-cols-2 gap-3">
          {ruleType !== 'date' && (
            <div ref={ohDaysRef} className={`relative ${ruleType === 'biweekly' ? '' : 'col-span-2'}`}>
              <label className="text-xs font-semibold text-espresso/60 block mb-1">
                Veckodagar
              </label>
              <button
                type="button"
                onClick={() => setOhDaysOpen((v) => !v)}
                className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 text-left flex items-center justify-between"
              >
                <span className={ohDays.length ? 'text-espresso' : 'text-espresso/40'}>
                  {ohDays.length
                    ? [...ohDays]
                        .sort((a, b) => a - b)
                        .map((d) => DAY_NAMES[d])
                        .join(', ')
                    : 'Välj dagar'}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${ohDaysOpen ? 'rotate-180' : ''}`}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {ohDaysOpen && (
                <div className="absolute z-10 mt-1 w-full bg-card rounded-lg border border-cream-warm shadow-lg py-1">
                  {DAY_NAMES.map((dayName, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-parchment cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={ohDays.includes(i)}
                        onChange={() => toggleDay(i)}
                        className="accent-rust w-4 h-4"
                      />
                      {dayName}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {ruleType === 'biweekly' && (
            <div>
              <label className="text-xs font-semibold text-espresso/60 block mb-1">
                Första tillfället
              </label>
              <input
                type="date"
                value={ohAnchorDate}
                onChange={(e) => setOhAnchorDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40"
              />
            </div>
          )}
          {ruleType === 'date' && (
            <div className="col-span-2">
              <label className="text-xs font-semibold text-espresso/60 block mb-1">
                Datum
              </label>
              <input
                type="date"
                value={ohAnchorDate}
                onChange={(e) => setOhAnchorDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-espresso/60 block mb-1">
              Öppnar
            </label>
            <input
              type="time"
              value={ohOpen}
              onChange={(e) => setOhOpen(e.target.value)}
              className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-espresso/60 block mb-1">
              Stänger
            </label>
            <input
              type="time"
              value={ohClose}
              onChange={(e) => setOhClose(e.target.value)}
              className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40"
            />
          </div>
        </div>

        {overlapWarning && (
          <p className="text-xs text-error font-medium">{overlapWarning}</p>
        )}

        <button
          type="button"
          onClick={addRule}
          disabled={!canAddRule}
          className="w-full h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
        >
          + Lägg till tid
        </button>
      </div>

      {/* Exceptions */}
      {exceptions.length > 0 && (
        <div className="space-y-2 mt-4">
          {exceptions.map((ex, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-parchment rounded-xl px-4 py-3"
            >
              <span className="text-sm">
                {new Date(ex.date + 'T12:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}
                {ex.reason && <span className="text-espresso/50 ml-1.5">({ex.reason})</span>}
              </span>
              <button
                type="button"
                onClick={() => setExceptions((prev) => prev.filter((_, j) => j !== i))}
                className="text-espresso/20 hover:text-error transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showExceptionForm ? (
        <div className="space-y-3 bg-parchment rounded-xl p-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-espresso/60 block mb-1">
                Datum
              </label>
              <input
                type="date"
                value={exDate}
                onChange={(e) => setExDate(e.target.value)}
                className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-espresso/60 block mb-1">
                Anledning (valfri)
              </label>
              <input
                type="text"
                value={exReason}
                onChange={(e) => setExReason(e.target.value)}
                placeholder="T.ex. helgdag"
                className="w-full h-10 rounded-lg bg-card px-3 text-sm border border-cream-warm outline-none focus:border-rust/40 placeholder:text-espresso/25"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowExceptionForm(false); setExDate(''); setExReason('') }}
              className="flex-1 h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={() => {
                if (!exDate) return
                setExceptions((prev) => [...prev, { date: exDate, reason: exReason || null }])
                setExDate('')
                setExReason('')
                setShowExceptionForm(false)
              }}
              disabled={!exDate}
              className="flex-1 h-9 rounded-lg bg-cream-warm text-sm font-semibold text-espresso/60 hover:bg-espresso/8 transition-colors disabled:opacity-30"
            >
              + Lägg till
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExceptionForm(true)}
          className="w-full mt-4 h-9 rounded-lg text-sm font-semibold text-espresso/40 hover:text-espresso/60 transition-colors"
        >
          + Lägg till undantag (stängd dag)
        </button>
      )}
    </>
  )
}
