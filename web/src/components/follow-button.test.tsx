/**
 * FollowButton smoke tests — run against the in-memory adapter via DepsProvider.
 *
 * Covers issue #151 acceptance criteria (market follow) and issue #152 (city follow):
 *   1. Logged-in user can follow a market and the button flips to "Följer"
 *   2. Logged-in user can unfollow a market and the button returns to "Följ"
 *   3. Anon user clicking "Följ" (market) is redirected to /auth?next=<current-path>
 *   4. Logged-in user can follow a city and the button flips to "Bevakar"
 *   5. Logged-in user can unfollow a city and the button returns to "Bevaka"
 *   6. Anon user clicking "Bevaka" (city) is redirected to /auth?next=<current-path>
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'

// ─── Next.js navigation mocks ────────────────────────────────────────────────

const mockPush = vi.fn()
let mockPathname = '/loppis/m1'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}))

// ─── Auth mock ────────────────────────────────────────────────────────────────

let mockUser: { id: string } | null = null

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// ─── PostHog mock ─────────────────────────────────────────────────────────────

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

// ─── Wrapper factory ──────────────────────────────────────────────────────────

import { FollowButton } from './follow-button'

function createWrapper(deps = makeInMemoryDeps()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <DepsProvider deps={deps}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </DepsProvider>
  )
}

beforeEach(() => {
  mockUser = null
  mockPathname = '/loppis/m1'
  mockPush.mockClear()
})

// ─── Market: Anon redirect ────────────────────────────────────────────────────

describe('FollowButton(market) — anon visitor', () => {
  it('shows "Följ" when not logged in', () => {
    mockUser = null
    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper() })
    expect(screen.getByRole('button')).toHaveTextContent('Följ')
  })

  it('redirects to /auth?next=<current-path> on click', () => {
    mockUser = null
    mockPathname = '/loppis/m1'
    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper() })
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/auth?next=%2Floppis%2Fm1')
  })
})

// ─── Market: Logged-in toggle ─────────────────────────────────────────────────

describe('FollowButton(market) — logged-in user', () => {
  it('initially shows "Följ" (not following)', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper(deps) })
    await waitFor(() =>
      expect(screen.getByRole('button')).not.toBeDisabled(),
    )
    expect(screen.getByRole('button')).toHaveTextContent('Följ')
  })

  it('flips to "Följer" after clicking "Följ"', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper(deps) })

    await waitFor(() =>
      expect(screen.getByRole('button')).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Följer'),
    )
  })

  it('returns to "Följ" after clicking "Följer"', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    await deps.follows.followMarket('u1', 'fm-1')

    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper(deps) })

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Följer'),
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Följ'),
    )
  })

  it('does not call router.push for logged-in user', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper(deps) })
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})

// ─── City: Anon redirect ──────────────────────────────────────────────────────

describe('FollowButton(city) — anon visitor', () => {
  it('shows "Bevaka" when not logged in', () => {
    mockUser = null
    mockPathname = '/loppisar/stockholm'
    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper() })
    expect(screen.getByRole('button')).toHaveTextContent('Bevaka')
  })

  it('redirects to /auth?next=<current-path> on click', () => {
    mockUser = null
    mockPathname = '/loppisar/stockholm'
    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper() })
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledWith('/auth?next=%2Floppisar%2Fstockholm')
  })
})

// ─── City: Logged-in toggle ───────────────────────────────────────────────────

describe('FollowButton(city) — logged-in user', () => {
  it('initially shows "Bevaka" (not following)', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper(deps) })
    await waitFor(() =>
      expect(screen.getByRole('button')).not.toBeDisabled(),
    )
    expect(screen.getByRole('button')).toHaveTextContent('Bevaka')
  })

  it('flips to "Bevakar" after clicking "Bevaka"', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper(deps) })

    await waitFor(() =>
      expect(screen.getByRole('button')).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevakar'),
    )
  })

  it('returns to "Bevaka" after clicking "Bevakar"', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    await deps.follows.followCity('u1', 'stockholm')

    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper(deps) })

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevakar'),
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevaka'),
    )
  })

  it('does not call router.push for logged-in city follow', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    render(<FollowButton kind="city" target="stockholm" />, { wrapper: createWrapper(deps) })
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
