import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Deps } from '@fyndstigen/shared'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'

// next/navigation's real notFound() throws an error with digest
// 'NEXT_NOT_FOUND'. We mirror the throw so the component's render unwinds,
// then catch it in a test-only ErrorBoundary below — otherwise the error
// bubbles to vitest's "unhandled error" handler and fails CI.
const NEXT_NOT_FOUND = 'NEXT_NOT_FOUND'
const mockNotFound = vi.fn(() => {
  const err = new Error(NEXT_NOT_FOUND) as Error & { digest?: string }
  err.digest = NEXT_NOT_FOUND
  throw err
})

class NotFoundBoundary extends React.Component<{ children: React.ReactNode }, { thrown: boolean }> {
  state = { thrown: false }
  static getDerivedStateFromError(err: unknown) {
    const digest = (err as { digest?: string } | null)?.digest
    if (digest === NEXT_NOT_FOUND) return { thrown: true }
    throw err
  }
  render() {
    return this.state.thrown ? null : this.props.children
  }
}
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'org-1' }),
  notFound: () => mockNotFound(),
}))
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }))
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: vi.fn() }))
vi.mock('@/components/fyndstigen-logo', () => ({ FyndstigenLogo: () => <div data-testid="loading" /> }))

import OrganizerProfilePage from './page'
import { useAuth } from '@/lib/auth/auth-context'

const mockOrganizer = {
  id: 'org-1',
  firstName: 'Lisa',
  lastName: 'Borg',
  bio: 'Loppisälskare',
  website: 'https://lisas-loppisar.se',
  phoneNumber: null,
  logoPath: null,
  subscriptionTier: 1,
}

const mockMarkets = [
  { id: 'm1', name: 'Söder Loppis', city: 'Stockholm', isPermanent: true, publishedAt: '2026-01-01' },
  { id: 'm2', name: 'Vasastan Fynd', city: 'Stockholm', isPermanent: false, publishedAt: '2026-02-01' },
]

// Deps surfaces touched by OrganizerProfilePage
const mockOrganizerGet = vi.fn()
const mockListByOrganizer = vi.fn()

const testDeps: Deps = (() => {
  const base = makeInMemoryDeps()
  return {
    ...base,
    organizers: { ...base.organizers, get: mockOrganizerGet },
    markets: { ...base.markets, listByOrganizer: mockListByOrganizer },
  }
})()

const render = (ui: React.ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        DepsProvider,
        { deps: testDeps },
        React.createElement(NotFoundBoundary, null, children),
      ),
  })

function setupMocks({
  user = null as { id: string } | null,
  organizer = mockOrganizer as any,
  markets = mockMarkets as any[],
  rejectOrganizer = false,
} = {}) {
  vi.mocked(useAuth).mockReturnValue({ user, loading: false } as ReturnType<typeof useAuth>)
  if (rejectOrganizer) {
    mockOrganizerGet.mockRejectedValue(new Error('Not found'))
  } else {
    mockOrganizerGet.mockResolvedValue(organizer)
  }
  mockListByOrganizer.mockResolvedValue(markets)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OrganizerProfilePage', () => {
  it('shows loading state', () => {
    // Make API calls never resolve so loading stays true
    vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>)
    mockOrganizerGet.mockReturnValue(new Promise(() => {}))
    mockListByOrganizer.mockReturnValue(new Promise(() => {}))

    render(<OrganizerProfilePage />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('triggers notFound() for unknown organizer', async () => {
    setupMocks({ rejectOrganizer: true })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled()
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
    setupMocks({ organizer: { ...mockOrganizer, subscriptionTier: 1 } })
    render(<OrganizerProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })
  })

  it('hides Premium badge for free organizer', async () => {
    setupMocks({ organizer: { ...mockOrganizer, subscriptionTier: 0 } })
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
