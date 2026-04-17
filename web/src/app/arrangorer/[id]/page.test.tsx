import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'org-1' }) }))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
vi.mock('@/lib/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/lib/api', () => ({
  api: { organizers: { get: vi.fn() }, fleaMarkets: { listByOrganizer: vi.fn() } },
}))
vi.mock('@/components/fyndstigen-logo', () => ({ FyndstigenLogo: () => <div data-testid="loading" /> }))

import OrganizerProfilePage from './page'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'

const mockOrganizer = {
  id: 'org-1',
  first_name: 'Lisa',
  last_name: 'Borg',
  bio: 'Loppisälskare',
  website: 'https://lisas-loppisar.se',
  phone_number: null,
  logo_path: null,
  subscription_tier: 1,
}

const mockMarkets = [
  { id: 'm1', name: 'Söder Loppis', city: 'Stockholm', is_permanent: true, published_at: '2026-01-01' },
  { id: 'm2', name: 'Vasastan Fynd', city: 'Stockholm', is_permanent: false, published_at: '2026-02-01' },
]

function setupMocks({
  user = null as { id: string } | null,
  organizer = mockOrganizer as any,
  markets = mockMarkets as any[],
  rejectOrganizer = false,
} = {}) {
  vi.mocked(useAuth).mockReturnValue({ user, loading: false } as ReturnType<typeof useAuth>)
  if (rejectOrganizer) {
    vi.mocked(api.organizers.get).mockRejectedValue(new Error('Not found'))
  } else {
    vi.mocked(api.organizers.get).mockResolvedValue(organizer)
  }
  vi.mocked(api.fleaMarkets.listByOrganizer).mockResolvedValue(markets)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrganizerProfilePage', () => {
  it('shows loading state', () => {
    // Make API calls never resolve so loading stays true
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>)
    vi.mocked(api.organizers.get).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.fleaMarkets.listByOrganizer).mockReturnValue(new Promise(() => {}))

    render(<OrganizerProfilePage />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows "Arrangören hittades inte" for unknown organizer', async () => {
    setupMocks({ rejectOrganizer: true })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Arrangören hittades inte')).toBeInTheDocument()
    })
  })

  it('shows organizer name and bio', async () => {
    setupMocks()
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Lisa Borg')).toBeInTheDocument()
      expect(screen.getByText('Loppisälskare')).toBeInTheDocument()
    })
  })

  it('shows Premium badge for premium organizer', async () => {
    setupMocks({ organizer: { ...mockOrganizer, subscription_tier: 1 } })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })
  })

  it('hides Premium badge for free organizer', async () => {
    setupMocks({ organizer: { ...mockOrganizer, subscription_tier: 0 } })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.queryByText('Premium')).not.toBeInTheDocument()
    })
  })

  it('shows "Visa statistik" link for owner', async () => {
    setupMocks({ user: { id: 'org-1' } })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Visa statistik')).toBeInTheDocument()
    })
  })

  it('hides "Visa statistik" link for non-owner', async () => {
    setupMocks({ user: { id: 'other-user' } })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.queryByText('Visa statistik')).not.toBeInTheDocument()
    })
  })

  it('lists published markets', async () => {
    setupMocks()
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Söder Loppis')).toBeInTheDocument()
      expect(screen.getByText('Vasastan Fynd')).toBeInTheDocument()
    })
  })
})
