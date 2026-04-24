import { renderHook, act } from '@testing-library/react'
import { useOpeningHoursDraft } from './use-opening-hours-draft'
import type { RuleDraft, ExceptionDraft } from '@fyndstigen/shared'

const weeklyRule: RuleDraft = {
  type: 'weekly',
  dayOfWeek: 6,
  anchorDate: null,
  openTime: '10:00',
  closeTime: '16:00',
}

const closedEx: ExceptionDraft = {
  date: '2025-12-24',
  reason: 'Stängt julafton',
}

describe('useOpeningHoursDraft', () => {
  it('initialises with provided rules and exceptions', () => {
    const { result } = renderHook(() =>
      useOpeningHoursDraft([weeklyRule], [closedEx]),
    )
    expect(result.current.rules).toEqual([weeklyRule])
    expect(result.current.exceptions).toEqual([closedEx])
  })

  it('addRule appends a rule', () => {
    const { result } = renderHook(() => useOpeningHoursDraft())
    act(() => result.current.addRule(weeklyRule))
    expect(result.current.rules).toHaveLength(1)
    expect(result.current.rules[0]).toEqual(weeklyRule)
  })

  it('updateRule replaces by index', () => {
    const updated: RuleDraft = { ...weeklyRule, dayOfWeek: 0 }
    const { result } = renderHook(() => useOpeningHoursDraft([weeklyRule]))
    act(() => result.current.updateRule(0, updated))
    expect(result.current.rules[0].dayOfWeek).toBe(0)
  })

  it('removeRule removes by index', () => {
    const { result } = renderHook(() => useOpeningHoursDraft([weeklyRule]))
    act(() => result.current.removeRule(0))
    expect(result.current.rules).toHaveLength(0)
  })

  it('addException appends an exception', () => {
    const { result } = renderHook(() => useOpeningHoursDraft())
    act(() => result.current.addException(closedEx))
    expect(result.current.exceptions).toHaveLength(1)
  })

  it('removeException removes by index', () => {
    const { result } = renderHook(() => useOpeningHoursDraft([], [closedEx]))
    act(() => result.current.removeException(0))
    expect(result.current.exceptions).toHaveLength(0)
  })

  it('reset replaces all rules and exceptions', () => {
    const { result } = renderHook(() => useOpeningHoursDraft([weeklyRule], [closedEx]))
    act(() => result.current.reset([], []))
    expect(result.current.rules).toHaveLength(0)
    expect(result.current.exceptions).toHaveLength(0)
  })

  it('serialize returns current rules and exceptions', () => {
    const { result } = renderHook(() => useOpeningHoursDraft([weeklyRule], [closedEx]))
    const s = result.current.serialize()
    expect(s.rules).toEqual([weeklyRule])
    expect(s.exceptions).toEqual([closedEx])
  })

  it('returned object is stable across renders when state has not changed', () => {
    const { result, rerender } = renderHook(() => useOpeningHoursDraft([weeklyRule]))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
