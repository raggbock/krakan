import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RouteFormFields } from './route-form-fields'

function defaultProps(overrides = {}) {
  return {
    name: '',
    onNameChange: vi.fn(),
    plannedDate: '',
    onPlannedDateChange: vi.fn(),
    useGps: true,
    onUseGpsChange: vi.fn(),
    ...overrides,
  }
}

describe('RouteFormFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders name input with correct value', () => {
    render(<RouteFormFields {...defaultProps({ name: 'Min runda' })} />)
    const input = screen.getByPlaceholderText(/Söndagsrundan/i) as HTMLInputElement
    expect(input.value).toBe('Min runda')
  })

  it('calls onNameChange when name input changes', () => {
    const onNameChange = vi.fn()
    render(<RouteFormFields {...defaultProps({ onNameChange })} />)
    const input = screen.getByPlaceholderText(/Söndagsrundan/i)
    fireEvent.change(input, { target: { value: 'Ny runda' } })
    expect(onNameChange).toHaveBeenCalledWith('Ny runda')
  })

  it('renders date input with correct value', () => {
    render(<RouteFormFields {...defaultProps({ plannedDate: '2026-05-01' })} />)
    const input = document.querySelector('input[type="date"]') as HTMLInputElement
    expect(input.value).toBe('2026-05-01')
  })

  it('calls onPlannedDateChange when date input changes', () => {
    const onPlannedDateChange = vi.fn()
    render(<RouteFormFields {...defaultProps({ onPlannedDateChange })} />)
    const input = document.querySelector('input[type="date"]')!
    fireEvent.change(input, { target: { value: '2026-06-15' } })
    expect(onPlannedDateChange).toHaveBeenCalledWith('2026-06-15')
  })

  it('highlights GPS button when useGps is true', () => {
    render(<RouteFormFields {...defaultProps({ useGps: true })} />)
    const gpsBtn = screen.getByText('Min position (GPS)')
    expect(gpsBtn.className).toContain('bg-card')
  })

  it('highlights map button when useGps is false', () => {
    render(<RouteFormFields {...defaultProps({ useGps: false })} />)
    const mapBtn = screen.getByText('Välj på kartan')
    expect(mapBtn.className).toContain('bg-card')
  })

  it('calls onUseGpsChange(true) when GPS button is clicked', () => {
    const onUseGpsChange = vi.fn()
    render(<RouteFormFields {...defaultProps({ useGps: false, onUseGpsChange })} />)
    fireEvent.click(screen.getByText('Min position (GPS)'))
    expect(onUseGpsChange).toHaveBeenCalledWith(true)
  })

  it('calls onUseGpsChange(false) when map button is clicked', () => {
    const onUseGpsChange = vi.fn()
    render(<RouteFormFields {...defaultProps({ useGps: true, onUseGpsChange })} />)
    fireEvent.click(screen.getByText('Välj på kartan'))
    expect(onUseGpsChange).toHaveBeenCalledWith(false)
  })
})
