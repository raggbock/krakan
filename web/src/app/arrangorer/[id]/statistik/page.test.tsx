import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAuth } from '@/lib/auth-context'
import { useOrganizerStats } from '@/hooks/use-organizer-stats'
import { api } from '@/lib/api'

// Mock next/navigation
const mockReplace = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user-1' }),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock auth
vi.mock('@/lib/auth-context', () => ({
  useAuth: vi.fn(),
}))

// Mock organizer stats hook
vi.mock('@/hooks/use-organizer-stats', () => ({
  useOrganizerStats: vi.fn(),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    organizers: {
      get: vi.fn(),
    },
  },
}))

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}))

// Mock logo component
vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <div data-testid="loading-logo" />,
}))

// Import the page after mocks are set up
import OrganizerStatsPage from './page'

const mockTotals = {
  pageviews_30d: 142,
  pageviews_total: 891,
  bookings_30d: 5,
  bookings_total: 23,
  revenue_30d_sek: 3400,
  revenue_total_sek: 15200,
  route_count_30d: 3,
  route_count_total: 12,
  conversion_30d: 8,
}

const mockMarkets = [
  {
    flea_market_id: 'm1',
    name: 'Söder Loppis',
    pageviews_30d: 80,
    pageviews_total: 500,
    bookings_initiated_30d: 10,
    bookings_30d: { pending: 1, confirmed: 2, denied: 0, cancelled: 0 },
    bookings_total: { pending: 2, confirmed: 10, denied: 1, cancelled: 2 },
    revenue_30d_sek: 1800,
    revenue_total_sek: 8000,
    route_count_30d: 2,
    route_count_total: 7,
    conversion_30d: 12,
  },
  {
    flea_market_id: 'm2',
    name: 'Norra Loppisen',
    pageviews_30d: 62,
    pageviews_total: 391,
    bookings_initiated_30d: 5,
    bookings_30d: { pending: 0, confirmed: 2, denied: 0, cancelled: 0 },
    bookings_total: { pending: 1, confirmed: 8, denied: 0, cancelled: 1 },
    revenue_30d_sek: 1600,
    revenue_total_sek: 7200,
    route_count_30d: 1,
    route_count_total: 5,
    conversion_30d: 8,
  },
]

function setupMocks({
  authLoading = false,
  user = { id: 'user-1' },
  statsLoading = false,
  statsError = null as string | null,
  markets = mockMarkets,
  totals = mockTotals,
  subscriptionTier = 0,
  tierReject = false,
} = {}) {
  vi.mocked(useAuth).mockReturnValue({ user, loading: authLoading } as ReturnType<typeof useAuth>)
  vi.mocked(useOrganizerStats).mockReturnValue({
    markets,
    totals,
    loading: statsLoading,
    error: statsError,
  })
  if (tierReject) {
    vi.mocked(api.organizers.get).mockRejectedValue(new Error('Network error'))
  } else {
    vi.mocked(api.organizers.get).mockResolvedValue({ subscription_tier: subscriptionTier } as Awaited<ReturnType<typeof api.organizers.get>>)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrganizerStatsPage', () => {
  it('shows loading state when auth is loading', () => {
    setupMocks({ authLoading: true })
    render(<OrganizerStatsPage />)
    expect(screen.getByTestId('loading-logo')).toBeInTheDocument()
  })

  it('shows loading state when stats are loading', async () => {
    setupMocks({ statsLoading: true })
    render(<OrganizerStatsPage />)
    expect(screen.getByTestId('loading-logo')).toBeInTheDocument()
  })

  it('redirects non-owner when user id does not match param id', async () => {
    setupMocks({ user: { id: 'other-user' } })
    render(<OrganizerStatsPage />)
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/arrangorer/user-1')
    })
  })

  it('free tier: shows locked card for Sidvisningar with Skyltfönstret overlay', async () => {
    setupMocks({ subscriptionTier: 0 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByText('Sidvisningar')).toBeInTheDocument()
    // Locked overlay text
    const skyltTexts = screen.getAllByText('Skyltfönstret')
    expect(skyltTexts.length).toBeGreaterThan(0)
  })

  it('free tier: shows free stats with values for Bokningar, Intäkter, I rundor', async () => {
    setupMocks({ subscriptionTier: 0 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByText('Bokningar')).toBeInTheDocument()
    expect(screen.getByText('Intäkter')).toBeInTheDocument()
    expect(screen.getByText('I rundor')).toBeInTheDocument()
    // Verify actual values appear
    expect(screen.getByText('5')).toBeInTheDocument() // bookings_30d
    expect(screen.getByText('3')).toBeInTheDocument() // route_count_30d
  })

  it('free tier: shows locked conversion card', async () => {
    setupMocks({ subscriptionTier: 0 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByText('Konvertering (besök till bokning)')).toBeInTheDocument()
    // The conversion card should have a locked overlay (multiple Skyltfönstret texts)
    const skyltTexts = screen.getAllByText('Skyltfönstret')
    expect(skyltTexts.length).toBeGreaterThanOrEqual(2)
  })

  it('free tier: shows upsell banner with upgrade button', async () => {
    setupMocks({ subscriptionTier: 0 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Uppgradera — 69 kr/mån' })).toBeInTheDocument()
  })

  it('free tier: hides per-market table', async () => {
    setupMocks({ subscriptionTier: 0 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('premium tier: shows Sidvisningar with actual value', async () => {
    setupMocks({ subscriptionTier: 1 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByText('Sidvisningar')).toBeInTheDocument()
    // 142 rendered via toLocaleString('sv-SE')
    expect(screen.getByText('142')).toBeInTheDocument()
  })

  it('premium tier: shows conversion percentage', async () => {
    setupMocks({ subscriptionTier: 1 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    const convTexts = screen.getAllByText(/8%/)
    expect(convTexts.length).toBeGreaterThan(0)
  })

  it('premium tier: shows per-market table with market names', async () => {
    setupMocks({ subscriptionTier: 1 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Söder Loppis')).toBeInTheDocument()
    expect(screen.getByText('Norra Loppisen')).toBeInTheDocument()
  })

  it('premium tier: does not show upsell banner', async () => {
    setupMocks({ subscriptionTier: 1 })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Uppgradera — 69 kr/mån' })).not.toBeInTheDocument()
  })

  it('shows error state when stats fetch fails', async () => {
    setupMocks({ statsError: 'Kunde inte hämta statistik' })
    render(<OrganizerStatsPage />)
    await waitFor(() => expect(screen.queryByTestId('loading-logo')).not.toBeInTheDocument())
    expect(screen.getByText('Kunde inte hämta statistik')).toBeInTheDocument()
  })
})
