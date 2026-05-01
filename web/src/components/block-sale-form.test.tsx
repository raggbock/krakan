import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockSaleForm } from './block-sale-form'

// No external module mocks needed — the form only uses validateBlockSaleInput
// from @fyndstigen/shared (resolved via vitest.config.ts alias) and React state.

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const PAST_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

function fillValidForm(container: HTMLElement) {
  // Name
  const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement
  fireEvent.change(nameInput, { target: { value: 'Sommarens Loppis' } })

  // City — find the city input (4th text input)
  const textInputs = container.querySelectorAll('input[type="text"]')
  const cityInput = textInputs[3] as HTMLInputElement // name, region, street not required for test
  // Use label to find city
  const cityField = screen.getByPlaceholderText('Örebro')
  fireEvent.change(cityField, { target: { value: 'Stockholm' } })
}

describe('BlockSaleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submitting with endDate < startDate shows error, does NOT call onSubmit', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<BlockSaleForm onSubmit={onSubmit} />)

    // Set name and city first
    fireEvent.change(screen.getByPlaceholderText(/Sommarloppis/i), {
      target: { value: 'Min Loppis' },
    })
    fireEvent.change(screen.getByPlaceholderText('Örebro'), {
      target: { value: 'Göteborg' },
    })

    // Set startDate to FUTURE and endDate to PAST (before start)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: FUTURE_DATE } })
    fireEvent.change(dateInputs[1], { target: { value: YESTERDAY } })

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Slutdatum kan inte vara före startdatum/i)).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submitting with dailyClose <= dailyOpen shows error, does NOT call onSubmit', async () => {
    const onSubmit = vi.fn()
    const { container } = render(<BlockSaleForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/Sommarloppis/i), {
      target: { value: 'Min Loppis' },
    })
    fireEvent.change(screen.getByPlaceholderText('Örebro'), {
      target: { value: 'Göteborg' },
    })

    // Both dates in the future and valid
    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: FUTURE_DATE } })
    fireEvent.change(dateInputs[1], { target: { value: FUTURE_DATE } })

    // Set close <= open (15:00 open, 10:00 close)
    const timeInputs = container.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '15:00' } }) // dailyOpen
    fireEvent.change(timeInputs[1], { target: { value: '10:00' } }) // dailyClose — before open

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Stängningstid måste vara efter öppningstid/i)).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submitting valid input calls onSubmit with the typed values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<BlockSaleForm onSubmit={onSubmit} />)

    fireEvent.change(screen.getByPlaceholderText(/Sommarloppis/i), {
      target: { value: 'Regnbågsgatan Kvartersloppis' },
    })
    fireEvent.change(screen.getByPlaceholderText('Örebro'), {
      target: { value: 'Stockholm' },
    })

    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: FUTURE_DATE } })
    fireEvent.change(dateInputs[1], { target: { value: FUTURE_DATE } })

    const timeInputs = container.querySelectorAll('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '09:00' } }) // open
    fireEvent.change(timeInputs[1], { target: { value: '16:00' } }) // close

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const call = onSubmit.mock.calls[0][0]
    expect(call.name).toBe('Regnbågsgatan Kvartersloppis')
    expect(call.city).toBe('Stockholm')
    expect(call.dailyOpen).toBe('09:00')
    expect(call.dailyClose).toBe('16:00')
  })

  it('publish toggle is initially off; toggling propagates publish: true to onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { container } = render(<BlockSaleForm onSubmit={onSubmit} />)

    // Verify checkbox starts unchecked
    const publishCheckbox = screen.getByRole('checkbox')
    expect(publishCheckbox).not.toBeChecked()

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText(/Sommarloppis/i), {
      target: { value: 'Min Loppis' },
    })
    fireEvent.change(screen.getByPlaceholderText('Örebro'), {
      target: { value: 'Lund' },
    })

    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: FUTURE_DATE } })
    fireEvent.change(dateInputs[1], { target: { value: FUTURE_DATE } })

    // Toggle publish on
    fireEvent.click(publishCheckbox)
    expect(publishCheckbox).toBeChecked()

    fireEvent.submit(container.querySelector('form')!)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })

    const call = onSubmit.mock.calls[0][0]
    expect(call.publish).toBe(true)
  })
})
