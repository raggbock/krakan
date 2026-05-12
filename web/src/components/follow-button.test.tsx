/**
 * FollowButton smoke tests — run against the in-memory adapter via DepsProvider.
 *
 * These cover the three scenarios from the issue #151 acceptance criteria:
 *   1. Logged-in user can follow and the button flips to "Följer"
 *   2. Logged-in user can unfollow and the button returns to "Följ"
 *   3. Anon user clicking "Följ" is redirected to /auth?next=<current-path>
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

// ─── Anon redirect ────────────────────────────────────────────────────────────

describe('FollowButton — anon visitor', () => {
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

// ─── Logged-in toggle ─────────────────────────────────────────────────────────

describe('FollowButton — logged-in user', () => {
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

    // Wait for initial query to resolve
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
    // Seed the follow
    await deps.follows.followMarket('u1', 'fm-1')

    render(<FollowButton kind="market" target="fm-1" />, { wrapper: createWrapper(deps) })

    // Wait for query to resolve to "Följer"
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

// ─── kind='city' — not yet active ─────────────────────────────────────────────

describe('FollowButton — kind=city', () => {
  it('renders nothing for kind=city (not yet implemented)', () => {
    mockUser = { id: 'u1' }
    const { container } = render(
      <FollowButton kind="city" target="stockholm" />,
      { wrapper: createWrapper() },
    )
    expect(container.firstChild).toBeNull()
  })
})
