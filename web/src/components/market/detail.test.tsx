import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false }),
}))

vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="fyndstigen-logo" />,
}))

vi.mock('@/components/booking/tables-card', () => ({
  BookableTablesCard: () => <div data-testid="bookable-tables" />,
}))

vi.mock('@/components/opening-hours-card', () => ({
  OpeningHoursCard: () => <div data-testid="opening-hours" />,
}))

vi.mock('@/components/back-link', () => ({
  BackLink: ({ href }: { href: string }) => <a href={href} data-testid="back-link" />,
}))

vi.mock('@/components/address-card', () => ({
  AddressCard: ({ street, city }: { street: string; city: string }) => (
    <div data-testid="address-card">{street}, {city}</div>
  ),
}))

vi.mock('@/components/organizer-card', () => ({
  OrganizerCard: ({ organizerName }: { organizerName: string }) => (
    <div data-testid="organizer-card">{organizerName}</div>
  ),
}))

vi.mock('@/components/market/image-gallery', () => ({
  MarketImageGallery: () => <div data-testid="image-gallery" />,
}))

vi.mock('@/components/add-to-route-button', () => ({
  AddToRouteButton: () => <button data-testid="add-to-route" />,
}))

vi.mock('@/components/auto-imported-notice', () => ({
  AutoImportedNotice: () => <div data-testid="auto-imported-notice" />,
}))

vi.mock('@/components/claim-market-button', () => ({
  ClaimMarketButton: () => <button data-testid="claim-market" />,
}))

vi.mock('@/hooks/use-market-detail-view-model', () => ({
  useMarketDetailViewModel: vi.fn(),
}))

import { MarketDetail } from './detail'
import { useMarketDetailViewModel } from '@/hooks/use-market-detail-view-model'
import type { FleaMarketDetailsView, MarketTableView } from '@fyndstigen/shared'

const mockMarket: FleaMarketDetailsView = {
  id: 'market-1',
  name: 'Stockholms Loppis',
  description: 'En fantastisk loppis i hjärtat av Stockholm.',
  city: 'Stockholm',
  street: 'Drottninggatan 1',
  zipCode: '111 21',
  country: 'SE',
  isPermanent: true,
  organizerId: 'organizer-1',
  organizerName: 'Test Arrangör',
  publishedAt: '2024-01-01T00:00:00Z',
  latitude: 59.33,
  longitude: 18.07,
  autoAcceptBookings: false,
  createdAt: '2024-01-01T00:00:00Z',
  slug: 'stockholms-loppis',
  isSystemOwned: false,
  contactWebsite: null,
  contactPhone: null,
  contactEmail: null,
  googlePlaceId: null,
  openingHourRules: [
    { id: 'r1', type: 'weekly', dayOfWeek: 1, anchorDate: null, openTime: '10:00', closeTime: '18:00' },
  ],
  openingHourExceptions: [],
  images: [],
}

const mockTables: MarketTableView[] = [
  {
    id: 'table-1',
    fleaMarketId: 'market-1',
    label: 'Bord A1',
    description: null,
    priceSek: 200,
    sizeDescription: null,
    isAvailable: true,
    maxPerDay: 1,
    sortOrder: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MarketDetail', () => {
  it('delegates to hook when market is null (E2E in-memory bridge path)', () => {
    // When page.tsx passes market={null}, MarketDetail must call the hook so
    // the client-side in-memory bridge can resolve data.
    const mockUseMarketDetailViewModel = vi.mocked(useMarketDetailViewModel)
    mockUseMarketDetailViewModel.mockReturnValue({
      market: null,
      tables: [],
      images: [],
      openingHours: undefined,
      isOwner: false,
      editUrl: '/loppis/market-1/edit',
      mapUrl: '/map',
      isLoading: true,
      error: null,
    })

    const { container } = render(<MarketDetail id="market-1" market={null} tables={[]} />)
    expect(mockUseMarketDetailViewModel).toHaveBeenCalledWith('market-1')
    // Loading state renders the skeleton (aria-busy), not an empty body
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('shows market name and city', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={[]} />)
    expect(screen.getByText('Stockholms Loppis')).toBeInTheDocument()
    expect(screen.getByTestId('address-card')).toBeInTheDocument()
  })

  it('shows description', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={[]} />)
    expect(screen.getByText('En fantastisk loppis i hjärtat av Stockholm.')).toBeInTheDocument()
  })

  it('shows "Permanent" badge for permanent market', () => {
    render(<MarketDetail id="market-1" market={{ ...mockMarket, isPermanent: true }} tables={[]} />)
    expect(screen.getByText('Permanent')).toBeInTheDocument()
  })

  it('shows "Tillfällig" badge for temporary market', () => {
    render(<MarketDetail id="market-1" market={{ ...mockMarket, isPermanent: false }} tables={[]} />)
    expect(screen.getByText('Tillfällig')).toBeInTheDocument()
  })

  it('shows BookableTablesCard when tables exist', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={mockTables} />)
    expect(screen.getByTestId('bookable-tables')).toBeInTheDocument()
  })

  it('shows opening hours when rules exist', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={[]} />)
    expect(screen.getByTestId('opening-hours')).toBeInTheDocument()
  })

  it('shows organizer card', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={[]} />)
    expect(screen.getByTestId('organizer-card')).toBeInTheDocument()
    expect(screen.getByText('Test Arrangör')).toBeInTheDocument()
  })

  it('shows h1 with market name', () => {
    render(<MarketDetail id="market-1" market={mockMarket} tables={[]} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stockholms Loppis')
  })
})
