/**
 * NavBell smoke test (E2E_FAKE mode).
 *
 * Seeds the in-memory notification repo with one delivery row and verifies:
 *   1. Bell badge shows "1"
 *   2. Clicking the bell opens the dropdown showing the seeded notification
 *   3. Clicking the notification row calls markRead → badge goes to 0 + navigation
 *
 * Uses the in-memory adapter via DepsProvider — no Supabase required.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeInMemoryDeps } from '@fyndstigen/shared/deps-factory'
import type { InMemoryNotificationRepo } from '@fyndstigen/shared'
import type { NotificationInboxRow } from '@fyndstigen/shared'
import { DepsProvider } from '@/providers/deps-provider'
import { NavBell } from './nav-bell'

// ─── Next.js mocks ────────────────────────────────────────────────────────────

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}))

// ─── Wrapper factory ──────────────────────────────────────────────────────────

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

// ─── Seed helper ──────────────────────────────────────────────────────────────

function makeInboxRow(overrides: Partial<NotificationInboxRow> = {}): NotificationInboxRow {
  return {
    eventId: 'ev-test-1',
    eventType: 'market.published',
    fleaMarketId: 'fm1',
    marketName: 'Sommarlopppis Teststad',
    marketSlug: 'sommarlopppis-teststad',
    citySlug: 'teststad',
    cityCanonicalName: 'Teststad',
    payload: {},
    occurredAt: new Date().toISOString(),
    readAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockPush.mockClear()
})

// ─── Smoke tests ──────────────────────────────────────────────────────────────

describe('NavBell smoke — E2E_FAKE mode', () => {
  it('shows badge "1" when there is one unread notification', async () => {
    const deps = makeInMemoryDeps()
    const notifRepo = deps.notifications as InMemoryNotificationRepo
    notifRepo._seed('u1', makeInboxRow())

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  it('clicking the bell opens the dropdown with the seeded notification', async () => {
    const deps = makeInMemoryDeps()
    const notifRepo = deps.notifications as InMemoryNotificationRepo
    notifRepo._seed('u1', makeInboxRow())

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    // Open dropdown
    const bellBtn = screen.getByRole('button', { name: /Notiser/i })
    fireEvent.click(bellBtn)

    await waitFor(() => {
      expect(screen.getByText(/Sommarlopppis Teststad är nu publicerad/)).toBeInTheDocument()
    })
  })

  it('clicking a notification row navigates to the market URL', async () => {
    const deps = makeInMemoryDeps()
    const notifRepo = deps.notifications as InMemoryNotificationRepo
    notifRepo._seed('u1', makeInboxRow())

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /Notiser/i }))

    await waitFor(() => {
      expect(screen.getByText(/Sommarlopppis Teststad/)).toBeInTheDocument()
    })

    // Click the notification row
    const notifButton = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Sommarlopppis Teststad'),
    )!
    fireEvent.click(notifButton)

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/loppis/sommarlopppis-teststad')
    })
  })

  it('after clicking a notification, the badge count drops to 0', async () => {
    const deps = makeInMemoryDeps()
    const notifRepo = deps.notifications as InMemoryNotificationRepo
    notifRepo._seed('u1', makeInboxRow())

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    // Confirm badge shows 1
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    // Open and click the notification
    fireEvent.click(screen.getByRole('button', { name: /Notiser/i }))

    await waitFor(() => {
      expect(screen.getByText(/Sommarlopppis Teststad/)).toBeInTheDocument()
    })

    const notifButton = screen.getAllByRole('button').find(
      (btn) => btn.textContent?.includes('Sommarlopppis Teststad'),
    )!
    fireEvent.click(notifButton)

    // Badge should disappear (unread count = 0)
    await waitFor(() => {
      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })
  })

  it('shows no badge when there are no unread notifications', async () => {
    const deps = makeInMemoryDeps()

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    // Allow queries to settle
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByText('1')).not.toBeInTheDocument()
    expect(screen.queryByText('9+')).not.toBeInTheDocument()
  })

  it('shows "9+" badge when there are more than 9 unread notifications', async () => {
    const deps = makeInMemoryDeps()
    const notifRepo = deps.notifications as InMemoryNotificationRepo

    for (let i = 0; i < 10; i++) {
      notifRepo._seed(
        'u1',
        makeInboxRow({
          eventId: `ev-${i}`,
          occurredAt: new Date(Date.now() - i * 60_000).toISOString(),
        }),
      )
    }

    render(<NavBell userId="u1" />, { wrapper: createWrapper(deps) })

    await waitFor(() => {
      expect(screen.getByText('9+')).toBeInTheDocument()
    })
  })
})
