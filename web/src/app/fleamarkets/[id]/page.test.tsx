import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'market-1' }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    fleaMarkets: { get: vi.fn() },
    images: { getPublicUrl: vi.fn((path: string) => `/images/${path}`) },
  },
}))

// Mock auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

// Mock useMarketDetails hook
vi.mock('@/hooks/use-market-details', () => ({
  useMarketDetails: vi.fn(),
}))

// Mock logo/loading component
vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="loading" />,
}))

// Mock BookableTablesCard
vi.mock('@/components/bookable-tables-card', () => ({
  BookableTablesCard: () => <div data-testid="bookable-tables" />,
}))

// Mock OpeningHoursCard
vi.mock('@/components/opening-hours-card', () => ({
  OpeningHoursCard: () => <div data-testid="opening-hours" />,
}))

// Mock BackLink
vi.mock('@/components/back-link', () => ({
  BackLink: ({ href }: { href: string }) => <a href={href} data-testid="back-link" />,
}))

// Mock AddressCard
vi.mock('@/components/address-card', () => ({
  AddressCard: ({ street, city }: { street: string; city: string }) => (
    <div data-testid="address-card">{street}, {city}</div>
  ),
}))

// Mock OrganizerCard
vi.mock('@/components/organizer-card', () => ({
  OrganizerCard: ({ organizerName }: { organizerName: string }) => (
    <div data-testid="organizer-card">{organizerName}</div>
  ),
}))

import { useMarketDetails } from '@/hooks/use-market-details'
import FleaMarketDetailsPage from './page'

const mockMarket = {
  id: 'market-1',
  name: 'Stockholms Loppis',
  description: 'En fantastisk loppis i hjärtat av Stockholm.',
  city: 'Stockholm',
  street: 'Drottninggatan 1',
  zip_code: '111 21',
  country: 'SE',
  is_permanent: true,
  organizer_id: 'organizer-1',
  organizerName: 'Test Arrangör',
  published_at: '2024-01-01T00:00:00Z',
  opening_hour_rules: [
    { day_of_week: 1, opens_at: '10:00', closes_at: '18:00' },
  ],
  opening_hour_exceptions: [],
  flea_market_images: [],
}

const mockTables = [
  {
    id: 'table-1',
    flea_market_id: 'market-1',
    label: 'Bord A1',
    description: null,
    price_sek: 200,
    is_available: true,
  },
]

function setupMocks({
  loading = false,
  market = mockMarket as typeof mockMarket | null,
  tables = [] as typeof mockTables,
} = {}) {
  vi.mocked(useMarketDetails).mockReturnValue({
    market: market as any,
    tables: tables as any,
    loading,
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('FleaMarketDetailsPage', () => {
  it('shows loading state', () => {
    setupMocks({ loading: true, market: null })
    render(<FleaMarketDetailsPage />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows "not found" when market does not exist', () => {
    setupMocks({ loading: false, market: null })
    render(<FleaMarketDetailsPage />)
    expect(screen.getByText('Loppisen hittades inte')).toBeInTheDocument()
    expect(screen.getByText(/Den kanske har tagits bort eller flyttat/)).toBeInTheDocument()
  })

  it('shows market name and city', () => {
    setupMocks()
    render(<FleaMarketDetailsPage />)
    expect(screen.getByText('Stockholms Loppis')).toBeInTheDocument()
    expect(screen.getByTestId('address-card')).toBeInTheDocument()
  })

  it('shows description', () => {
    setupMocks()
    render(<FleaMarketDetailsPage />)
    expect(screen.getByText('En fantastisk loppis i hjärtat av Stockholm.')).toBeInTheDocument()
  })

  it('shows "Permanent" badge for permanent market', () => {
    setupMocks({ market: { ...mockMarket, is_permanent: true } })
    render(<FleaMarketDetailsPage />)
    expect(screen.getByText('Permanent')).toBeInTheDocument()
  })

  it('shows "Tillfällig" badge for temporary market', () => {
    setupMocks({ market: { ...mockMarket, is_permanent: false } })
    render(<FleaMarketDetailsPage />)
    expect(screen.getByText('Tillfällig')).toBeInTheDocument()
  })

  it('shows BookableTablesCard when tables exist', () => {
    setupMocks({ tables: mockTables })
    render(<FleaMarketDetailsPage />)
    expect(screen.getByTestId('bookable-tables')).toBeInTheDocument()
  })

  it('shows opening hours when rules exist', () => {
    setupMocks()
    render(<FleaMarketDetailsPage />)
    expect(screen.getByTestId('opening-hours')).toBeInTheDocument()
  })

  it('shows organizer link', () => {
    setupMocks()
    render(<FleaMarketDetailsPage />)
    expect(screen.getByTestId('organizer-card')).toBeInTheDocument()
    expect(screen.getByText('Test Arrangör')).toBeInTheDocument()
  })
})
