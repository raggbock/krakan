import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import BookingsPage from './page'
import type { Deps } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import React from 'react'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    organizers: { stats: vi.fn() },
    edge: { invoke: vi.fn().mockResolvedValue({}) },
    endpoints: {
      'stripe.payment.capture': { invoke: vi.fn().mockResolvedValue({ success: true }) },
      'stripe.payment.cancel': { invoke: vi.fn().mockResolvedValue({ success: true }) },
    },
  },
}))

vi.mock('@/lib/edge', () => ({
  edge: { invoke: vi.fn().mockResolvedValue({}) },
  endpoints: {
    'stripe.payment.capture': { invoke: vi.fn().mockResolvedValue({ success: true }) },
    'stripe.payment.cancel': { invoke: vi.fn().mockResolvedValue({ success: true }) },
  },
}))

// Deps surfaces touched by BookingsPage (markets.listByOrganizer + bookings.listByMarket).
const mockListByOrganizer = vi.fn()
const mockListByMarket = vi.fn()

const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    markets: { ...base.markets, listByOrganizer: mockListByOrganizer },
    bookings: { ...base.bookings, listByMarket: mockListByMarket },
  }
})()

const render = (ui: React.ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(DepsProvider, { deps: testDeps }, children),
  })

vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="loading" />,
}))

import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import { endpoints } from '@/lib/edge'

const mockUser = { id: 'u1', email: 'organizer@test.se' }

const mockMarket = { id: 'fm1', name: 'Sommarlopppis', organizer_id: 'u1' }

// mockBooking uses the BookingView (camelCase) shape produced by mapBookingView
const mockBooking = {
  id: 'b1',
  table: { id: 't1', label: 'Bord A', description: null, sizeDescription: null },
  market: null,
  booker: { id: 'u2', firstName: 'Erik', lastName: 'Nilsson' },
  date: '2026-05-01',
  status: 'pending',
  price: { baseSek: 200, commissionSek: 24, commissionRate: 0.12 },
  message: 'Säljer kläder',
  organizerNote: null,
  payment: { status: 'requires_capture', intentId: 'pi_test', expiresAt: null },
  createdAt: '',
}

const mockConfirmedBooking = {
  ...mockBooking,
  id: 'b2',
  status: 'confirmed',
  payment: { status: 'captured', intentId: 'pi_test', expiresAt: null },
  booker: { id: 'u3', firstName: 'Sara', lastName: 'Borg' },
}

const mockStats = {
  organizer_id: 'u1',
  market_count: 2,
  total_bookings: 5,
  total_revenue_sek: 3400,
  total_commission_sek: 408,
}

function mockAuthLoggedIn() {
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser as any,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
}

function mockAuthLoading() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
}

function mockAuthLoggedOut() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListByOrganizer.mockResolvedValue([mockMarket])
  mockListByMarket.mockResolvedValue([])
  vi.mocked(api.organizers.stats).mockResolvedValue(mockStats as never)
  vi.mocked(api.edge.invoke).mockResolvedValue({})
  vi.mocked(endpoints['stripe.payment.capture'].invoke).mockResolvedValue({ success: true })
})

describe('BookingsPage', () => {
  it('shows loading state', () => {
    mockAuthLoading()
    render(<BookingsPage />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('redirects to /auth when not logged in', async () => {
    mockAuthLoggedOut()
    render(<BookingsPage />)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth')
    })
  })

  it('shows empty state', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([])
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Inga bokningar ännu')).toBeInTheDocument()
    })
  })

  it('shows stats cards', async () => {
    mockAuthLoggedIn()
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('3400 kr')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('shows pending bookings with action buttons', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([mockBooking])
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Väntar på svar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Godkänn' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Neka' })).toBeInTheDocument()
    })
  })

  it('shows confirmed bookings without action buttons', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([mockConfirmedBooking])
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Bekräftade')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Godkänn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Neka' })).not.toBeInTheDocument()
  })

  it('shows booker name and booking details', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([mockBooking])
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('Erik Nilsson')).toBeInTheDocument()
      expect(screen.getByText('Bord A', { exact: false })).toBeInTheDocument()
      expect(screen.getByText('200 kr')).toBeInTheDocument()
    })
  })

  it('approve calls stripe-payment-capture via api.endpoints', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([mockBooking])
    render(<BookingsPage />)

    const approveBtn = await screen.findByRole('button', { name: 'Godkänn' })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(vi.mocked(endpoints['stripe.payment.capture'].invoke)).toHaveBeenCalledWith(
        { bookingId: 'b1' },
      )
    })
  })

  it('deny calls stripe-payment-cancel', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([mockBooking])
    render(<BookingsPage />)

    const denyBtn = await screen.findByRole('button', { name: 'Neka' })
    fireEvent.click(denyBtn)

    await waitFor(() => {
      expect(vi.mocked(endpoints['stripe.payment.cancel'].invoke)).toHaveBeenCalledWith(
        { bookingId: 'b1', newStatus: 'denied' },
      )
    })
  })

  it('shows payment status labels', async () => {
    mockAuthLoggedIn()
    mockListByMarket.mockResolvedValue([
      mockBooking,
      mockConfirmedBooking,
    ])
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText('(reserverat)')).toBeInTheDocument()
      expect(screen.getByText('(betald)')).toBeInTheDocument()
    })
  })
})
