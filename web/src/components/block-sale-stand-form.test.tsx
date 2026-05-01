import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BlockSaleStandForm } from './block-sale-stand-form'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/edge', () => ({
  endpoints: {
    'block-sale.stand.apply': {
      invoke: vi.fn(),
    },
  },
}))

vi.mock('posthog-js/react', () => ({
  usePostHog: () => null,
}))

import { endpoints } from '@/lib/edge'
const mockInvoke = (endpoints as any)['block-sale.stand.apply'].invoke as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/e-postadress/i), {
    target: { value: 'anna@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/fullständigt namn/i), {
    target: { value: 'Anna Svensson' },
  })
  fireEvent.change(screen.getByLabelText(/gatuadress/i), {
    target: { value: 'Regnbågsgatan 5' },
  })
  // Description (required)
  const description = screen.getByLabelText(/vad tänker du sälja/i)
  fireEvent.change(description, {
    target: { value: 'Böcker, kläder och porslin.' },
  })
}

const DEFAULT_PROPS = {
  blockSaleId: 'bs-001',
  defaultCity: 'Stockholm',
  onSuccess: vi.fn(),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlockSaleStandForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    DEFAULT_PROPS.onSuccess = vi.fn()
  })

  it('honeypot "website" field has tabIndex={-1} and is positioned off-screen', () => {
    const { container } = render(<BlockSaleStandForm {...DEFAULT_PROPS} />)

    const honeypot = container.querySelector('input[name="website"]') as HTMLInputElement
    expect(honeypot).not.toBeNull()
    expect(honeypot.tabIndex).toBe(-1)
    // aria-hidden hides from assistive tech
    expect(honeypot.getAttribute('aria-hidden')).toBe('true')
    // Off-screen positioning via absolute left-[-9999px]
    const classes = honeypot.className
    expect(classes).toContain('-9999px')
  })

  it('filling the honeypot → shows "Något gick fel" error, does NOT call onSuccess', async () => {
    // Simulate server-side honeypot rejection
    mockInvoke.mockRejectedValue({ code: 'honeypot', message: 'honeypot triggered' })

    render(<BlockSaleStandForm {...DEFAULT_PROPS} />)

    // Fill honeypot field (humans can't see it, but bots do)
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement
    fireEvent.change(honeypot, { target: { value: 'http://spam.example.com' } })

    fillRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      // Must show a generic error — NOT one that reveals the honeypot mechanism
      expect(screen.getByRole('alert')).toHaveTextContent(/Något gick fel/i)
    })
    expect(DEFAULT_PROPS.onSuccess).not.toHaveBeenCalled()
    // Ensure the error does NOT contain the word "honeypot"
    expect(screen.getByRole('alert').textContent).not.toMatch(/honeypot/i)
  })

  it('description charcount is visible and updates as user types', () => {
    render(<BlockSaleStandForm {...DEFAULT_PROPS} />)

    const description = screen.getByLabelText(/vad tänker du sälja/i)
    // Initially: 0/200
    expect(screen.getByText('0/200 tecken')).toBeInTheDocument()

    fireEvent.change(description, { target: { value: 'Hej!' } })
    expect(screen.getByText('4/200 tecken')).toBeInTheDocument()

    fireEvent.change(description, { target: { value: 'Böcker och porslin.' } })
    expect(screen.getByText('19/200 tecken')).toBeInTheDocument()
  })

  it('successful submit calls onSuccess after endpoints invoke resolves with ok: true', async () => {
    mockInvoke.mockResolvedValue({ ok: true })

    render(<BlockSaleStandForm {...DEFAULT_PROPS} />)

    fillRequiredFields()
    fireEvent.submit(document.querySelector('form')!)

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSuccess).toHaveBeenCalledOnce()
    })
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        blockSaleId: 'bs-001',
        email: 'anna@example.com',
        name: 'Anna Svensson',
        street: 'Regnbågsgatan 5',
      }),
    )
  })
})
