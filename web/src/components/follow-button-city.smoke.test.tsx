/**
 * City follow smoke test (E2E_FAKE mode).
 *
 * Exercises issue #152 acceptance criteria:
 *   - Follow a city from /loppisar/[city] → button flips to "Bevakar"
 *   - Anon click → redirect to /auth?next=/loppisar/<slug>
 *
 * Uses the in-memory adapter (no Supabase required) to simulate the full
 * optimistic-update flow without a real network.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import { DepsProvider } from '@/providers/deps-provider'
import { FollowButton } from '@/components/follow-button'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
let mockPathname = '/loppisar/stockholm'

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}))

let mockUser: { id: string } | null = null

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper(deps = makeInMemoryDeps()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <DepsProvider deps={deps}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DepsProvider>
    )
  }
}

beforeEach(() => {
  mockUser = null
  mockPathname = '/loppisar/stockholm'
  mockPush.mockClear()
})

// ─── Smoke: city follow from /loppisar/[city] ─────────────────────────────────

describe('City follow smoke — /loppisar/[city]', () => {
  it('logged-in: button starts as "Bevaka" and flips to "Bevakar" after click', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()

    render(
      <FollowButton kind="city" target="stockholm" source="city_page" />,
      { wrapper: createWrapper(deps) },
    )

    // Wait for initial query to resolve
    await waitFor(() =>
      expect(screen.getByRole('button')).not.toBeDisabled(),
    )

    expect(screen.getByRole('button')).toHaveTextContent('Bevaka')

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevakar'),
    )

    // Verify the in-memory repo actually persisted the follow
    expect(await deps.follows.isFollowingCity('u1', 'stockholm')).toBe(true)
  })

  it('logged-in: "Bevakar" flips back to "Bevaka" on second click (unfollow)', async () => {
    mockUser = { id: 'u1' }
    const deps = makeInMemoryDeps()
    await deps.follows.followCity('u1', 'stockholm')

    render(
      <FollowButton kind="city" target="stockholm" source="city_page" />,
      { wrapper: createWrapper(deps) },
    )

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevakar'),
    )

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveTextContent('Bevaka'),
    )

    expect(await deps.follows.isFollowingCity('u1', 'stockholm')).toBe(false)
  })

  it('anon: click redirects to /auth?next=/loppisar/stockholm', () => {
    mockUser = null
    mockPathname = '/loppisar/stockholm'

    render(
      <FollowButton kind="city" target="stockholm" source="city_page" />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByRole('button')).toHaveTextContent('Bevaka')

    fireEvent.click(screen.getByRole('button'))

    expect(mockPush).toHaveBeenCalledWith('/auth?next=%2Floppisar%2Fstockholm')
  })

  it('anon: correct next param for a different city slug', () => {
    mockUser = null
    mockPathname = '/loppisar/goteborg'

    render(
      <FollowButton kind="city" target="goteborg" source="city_page" />,
      { wrapper: createWrapper() },
    )

    fireEvent.click(screen.getByRole('button'))

    expect(mockPush).toHaveBeenCalledWith('/auth?next=%2Floppisar%2Fgoteborg')
  })
})
