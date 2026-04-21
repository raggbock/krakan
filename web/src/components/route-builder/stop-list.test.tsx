import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { StopList, type RouteStop } from './stop-list'

vi.mock('@fyndstigen/shared', () => ({
  checkOpeningHours: vi.fn(() => null),
}))

vi.mock('../fyndstigen-logo', () => ({
  FyndstigenLogo: () => <svg data-testid="fyndstigen-logo" />,
}))

function makeStop(id: string, name: string, index: number): RouteStop {
  return {
    market: {
      id,
      name,
      city: 'Teststad',
      latitude: 59.0,
      longitude: 15.0,
      distance_km: 1,
      opening_hour_rules: [],
      opening_hour_exceptions: [],
    } as any,
    index,
  }
}

describe('StopList', () => {
  const defaultProps = {
    stops: [],
    plannedDate: '',
    onReorder: vi.fn(),
    onRemove: vi.fn(),
    onOptimize: vi.fn(),
    canOptimize: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state when no stops', () => {
    render(<StopList {...defaultProps} />)
    expect(screen.getByText(/Klicka på en markör/)).toBeInTheDocument()
  })

  it('renders stops with names and numbers', () => {
    const stops = [makeStop('a', 'Loppis A', 0), makeStop('b', 'Loppis B', 1)]
    render(<StopList {...defaultProps} stops={stops} />)
    expect(screen.getByText('Loppis A')).toBeInTheDocument()
    expect(screen.getByText('Loppis B')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('remove button fires onRemove with the correct id', () => {
    const onRemove = vi.fn()
    const stops = [makeStop('a', 'Loppis A', 0), makeStop('b', 'Loppis B', 1)]
    render(<StopList {...defaultProps} stops={stops} onRemove={onRemove} />)

    // Two remove buttons — click the first one (Loppis A = id 'a')
    const removeButtons = screen.getAllByRole('button', { name: '' })
    fireEvent.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith('a')
  })

  it('optimize button fires onOptimize', () => {
    const onOptimize = vi.fn()
    const stops = [makeStop('a', 'Loppis A', 0), makeStop('b', 'Loppis B', 1)]
    render(
      <StopList
        {...defaultProps}
        stops={stops}
        onOptimize={onOptimize}
        canOptimize={true}
      />,
    )
    fireEvent.click(screen.getByText('Optimera rutt'))
    expect(onOptimize).toHaveBeenCalledTimes(1)
  })

  it('optimize button is hidden when canOptimize is false', () => {
    const stops = [makeStop('a', 'Loppis A', 0), makeStop('b', 'Loppis B', 1)]
    render(<StopList {...defaultProps} stops={stops} canOptimize={false} />)
    expect(screen.queryByText('Optimera rutt')).not.toBeInTheDocument()
  })

  it('drag reorder calls onReorder with correctly reordered array', () => {
    const onReorder = vi.fn()
    const stops = [
      makeStop('a', 'Loppis A', 0),
      makeStop('b', 'Loppis B', 1),
      makeStop('c', 'Loppis C', 2),
    ]
    render(<StopList {...defaultProps} stops={stops} onReorder={onReorder} />)

    const items = screen.getAllByText(/Loppis/).map((el) => el.closest('[draggable]')!)

    // Drag item at index 0 (A) onto index 2 (C)
    fireEvent.dragStart(items[0])
    fireEvent.dragOver(items[2], { preventDefault: () => {} })

    expect(onReorder).toHaveBeenCalled()
    const reordered = onReorder.mock.calls[0][0] as RouteStop[]
    // After moving A from 0 to 2: [B, C, A]
    expect(reordered.map((s) => s.market.id)).toEqual(['b', 'c', 'a'])
  })

  it('dragEnd resets drag state', () => {
    const stops = [makeStop('a', 'Loppis A', 0), makeStop('b', 'Loppis B', 1)]
    render(<StopList {...defaultProps} stops={stops} />)
    const items = screen.getAllByText(/Loppis/).map((el) => el.closest('[draggable]')!)
    fireEvent.dragStart(items[0])
    fireEvent.dragEnd(items[0])
    // No error thrown — state resets cleanly
  })
})
