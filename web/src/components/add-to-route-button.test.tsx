import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AddToRouteButton } from './add-to-route-button'
import { DRAFT_KEY, readDraft } from '@/hooks/route-builder/draft'

beforeEach(() => {
  window.localStorage.clear()
})

describe('AddToRouteButton', () => {
  it('renders the "Lägg till i rundan" label when market not in draft', () => {
    render(<AddToRouteButton marketId="m-1" source="market_detail" />)
    expect(screen.getByRole('button')).toHaveTextContent(/Lägg till i rundan/)
  })

  it('adds the market to the draft on click and shows confirmation', () => {
    render(<AddToRouteButton marketId="m-1" source="market_detail" />)
    fireEvent.click(screen.getByRole('button'))

    const draft = readDraft(window.localStorage, Date.now)
    expect(draft?.stops).toEqual([{ marketId: 'm-1', index: 0 }])

    expect(screen.getByRole('status')).toHaveTextContent(/Rundan började/)
    expect(screen.getByRole('button')).toHaveTextContent(/I rundan/)
  })

  it('shows multi-stop confirmation copy when the draft already has stops', () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: '',
        plannedDate: '',
        useGps: true,
        customStart: null,
        stops: [{ marketId: 'm-0', index: 0 }],
        savedAt: new Date().toISOString(),
      }),
    )
    render(<AddToRouteButton marketId="m-1" source="market_detail" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('status')).toHaveTextContent(/Du har 2 stopp/)
  })

  it('reflects existing draft state on mount', () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        name: '',
        plannedDate: '',
        useGps: true,
        customStart: null,
        stops: [{ marketId: 'm-1', index: 0 }],
        savedAt: new Date().toISOString(),
      }),
    )
    render(<AddToRouteButton marketId="m-1" source="market_detail" />)
    expect(screen.getByRole('button')).toHaveTextContent(/I rundan/)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not duplicate when clicked twice', () => {
    render(<AddToRouteButton marketId="m-1" source="market_detail" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    const draft = readDraft(window.localStorage, Date.now)
    expect(draft?.stops).toHaveLength(1)
  })

  it('renders compact variant as an icon button', () => {
    render(<AddToRouteButton marketId="m-1" source="explore_card" compact />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', 'Lägg till i rundan')
    expect(btn).toHaveTextContent('+')
  })
})
