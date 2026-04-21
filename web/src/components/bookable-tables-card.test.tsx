import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BookableTablesCard } from './bookable-tables-card'
import type { MarketTable } from '@/lib/api'

vi.mock('@/lib/flags', () => ({ useFlag: () => true, getFlagEnv: () => true }))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/hooks/use-booking', () => ({ useBooking: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripePromise: null }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => children,
  CardElement: () => <div data-testid="card-element" />,
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

import { useAuth } from '@/lib/auth-context'
import { useBooking } from '@/hooks/use-booking'

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>
const mockUseBooking = useBooking as ReturnType<typeof vi.fn>

const paidTable: MarketTable = {
  id: 't1',
  flea_market_id: 'fm1',
  label: 'Bord A',
  description: 'Inne',
  price_sek: 200,
  size_description: '2x1m',
  is_available: true,
  max_per_day: 1,
  sort_order: 0,
  created_at: '',
  updated_at: '',
}

const freeTable: MarketTable = {
  ...paidTable,
  id: 't2',
  label: 'Bord B',
  price_sek: 0,
}

const defaultBooking = {
  selectedTable: null,
  date: '',
  message: '',
  bookedDates: [],
  selectTable: vi.fn(),
  setDate: vi.fn(),
  setMessage: vi.fn(),
  dateValidation: { valid: false },
  commission: 0,
  totalPrice: 0,
  isFree: false,
  canSubmit: false,
  submit: vi.fn(),
  isSubmitting: false,
  isDone: false,
  submitError: null,
  reset: vi.fn(),
}

function setup(bookingOverrides = {}, userOverride: any = { id: 'u1' }) {
  mockUseAuth.mockReturnValue({ user: userOverride })
  mockUseBooking.mockReturnValue({ ...defaultBooking, ...bookingOverrides })
}

describe('BookableTablesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders table list with labels and prices', () => {
    setup()
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable, freeTable]} />)
    expect(screen.getByText('Bord A')).toBeInTheDocument()
    expect(screen.getByText('200 kr')).toBeInTheDocument()
    expect(screen.getByText('Bord B')).toBeInTheDocument()
  })

  it('shows "Gratis" for 0 kr table', () => {
    setup()
    render(<BookableTablesCard fleaMarketId="fm1" tables={[freeTable]} />)
    expect(screen.getByText('Gratis')).toBeInTheDocument()
  })

  it('clicking table selects it and shows date input', () => {
    const selectTable = vi.fn()
    setup({ selectTable })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)

    // Before selection, no date input
    expect(screen.queryByLabelText(/datum/i)).not.toBeInTheDocument()

    // Simulate click
    fireEvent.click(screen.getByText('Bord A'))
    expect(selectTable).toHaveBeenCalledWith(paidTable)

    // Now render with the table selected
    mockUseBooking.mockReturnValue({
      ...defaultBooking,
      selectTable,
      selectedTable: paidTable,
    })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByText('Datum')).toBeInTheDocument()
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument()
  })

  it('shows "Logga in för att boka" when no user', () => {
    setup({ selectedTable: paidTable }, null)
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByText('Logga in för att boka')).toBeInTheDocument()
  })

  it('shows "Boka" button for free table when logged in', () => {
    setup({ selectedTable: freeTable, isFree: true })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[freeTable]} />)
    expect(screen.getByRole('button', { name: 'Boka' })).toBeInTheDocument()
  })

  it('shows "Boka & reservera" for paid table when logged in', () => {
    setup({ selectedTable: paidTable, isFree: false })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByRole('button', { name: 'Boka & reservera' })).toBeInTheDocument()
  })

  it('shows commission text for paid table', () => {
    setup({
      selectedTable: paidTable,
      isFree: false,
      commission: 24,
      totalPrice: 224,
    })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByText(/inkl 24 kr avgift/)).toBeInTheDocument()
  })

  it('hides card element for free table', () => {
    setup({ selectedTable: freeTable, isFree: true })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[freeTable]} />)
    expect(screen.queryByTestId('card-element')).not.toBeInTheDocument()
  })

  it('shows success message when isDone', () => {
    setup({ isDone: true, isFree: true })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByText('Bokning skickad!')).toBeInTheDocument()
  })

  it('shows "Behandlar..." when submitting', () => {
    setup({ selectedTable: paidTable, isFree: false, isSubmitting: true })
    render(<BookableTablesCard fleaMarketId="fm1" tables={[paidTable]} />)
    expect(screen.getByRole('button', { name: 'Behandlar...' })).toBeInTheDocument()
  })
})
