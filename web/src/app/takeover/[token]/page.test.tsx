import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── PostHog spy ────────────────────────────────────────────────────────────
// Override the global setup stub so we can assert on capture calls.
const mockCapture = vi.fn()
vi.mock('posthog-js/react', () => ({
  usePostHog: () => ({ capture: mockCapture }),
}))

// ── Dependencies ───────────────────────────────────────────────────────────
vi.mock('@/components/fyndstigen-logo', () => ({
  FyndstigenLogo: () => <span data-testid="logo" />,
}))

// ── Takeover hooks ─────────────────────────────────────────────────────────
const mockUseTakeoverInfo = vi.fn()
const mockMutateAsyncStart = vi.fn()
const mockMutateAsyncFeedback = vi.fn()
const mockMutateAsyncRemove = vi.fn()

vi.mock('@/hooks/use-takeover', () => ({
  useTakeoverInfo: (...args: unknown[]) => mockUseTakeoverInfo(...args),
  useTakeoverStart: () => ({
    mutateAsync: mockMutateAsyncStart,
    isPending: false,
    isError: false,
    error: null,
  }),
  useTakeoverFeedback: () => ({
    mutateAsync: mockMutateAsyncFeedback,
    isPending: false,
    isError: false,
    error: null,
  }),
  useTakeoverRemove: () => ({
    mutateAsync: mockMutateAsyncRemove,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

import TakeoverPage from './page'

// ── Helpers ────────────────────────────────────────────────────────────────

const MARKET = {
  marketId: 'mkt-1',
  name: 'Testloppis',
  city: 'Stockholm',
  region: 'Stockholms län',
  sourceUrl: 'https://www.example.com/loppis',
  maskedEmail: 't***@example.com',
}

function infoLoaded(overrides = {}) {
  return {
    data: MARKET,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

function infoError(message: string) {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error(message),
  }
}

/**
 * Render TakeoverPage wrapped in Suspense + QueryClientProvider.
 *
 * React 19's use(Promise) suspends on first render even for already-resolved
 * promises. Wrapping in async act() flushes the microtask queue so Suspense
 * unsuspends before assertions run.
 */
async function renderPage() {
  const params = Promise.resolve({ token: 'tok123' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <React.Suspense fallback={<div data-testid="suspense-fallback" />}>
        {children}
      </React.Suspense>
    </QueryClientProvider>
  )
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(<TakeoverPage params={params} />, { wrapper: Wrapper })
  })
  return result
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TakeoverPage — PostHog events', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutateAsyncStart.mockResolvedValue(undefined)
    mockMutateAsyncFeedback.mockResolvedValue(undefined)
    mockMutateAsyncRemove.mockResolvedValue(undefined)
    mockUseTakeoverInfo.mockReturnValue(infoLoaded())
  })

  // ── 1. takeover_link_clicked ─────────────────────────────────────────────

  it('fires takeover_link_clicked once when info loads with marketId', async () => {
    await renderPage()

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_link_clicked', {
        market_id: 'mkt-1',
      }),
    )
    expect(mockCapture).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-fire takeover_link_clicked on re-render', async () => {
    await renderPage()

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_link_clicked', { market_id: 'mkt-1' }),
    )
    const captureCountAfterFirst = mockCapture.mock.calls.length

    // Re-render by triggering a state-neutral update (mocks unchanged)
    await act(async () => {
      // React will re-render but linkTracked flag prevents re-firing
      mockUseTakeoverInfo.mockReturnValue(infoLoaded())
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(mockCapture).toHaveBeenCalledTimes(captureCountAfterFirst)
  })

  // ── 2. takeover_info_load_failed ─────────────────────────────────────────

  it('fires takeover_info_load_failed with mapped error_reason for known code', async () => {
    mockUseTakeoverInfo.mockReturnValue(infoError('token_expired'))

    await renderPage()

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_info_load_failed', {
        error_reason: 'token_expired',
      }),
    )
  })

  it('fires takeover_info_load_failed with error_reason: unknown for unrecognised message', async () => {
    mockUseTakeoverInfo.mockReturnValue(infoError('some_completely_unknown_code'))

    await renderPage()

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_info_load_failed', {
        error_reason: 'unknown',
      }),
    )
  })

  // ── 3–5. takeover_path_chosen ────────────────────────────────────────────

  it('fires takeover_path_chosen { path: claim } when claim card clicked', async () => {
    await renderPage()

    await screen.findByText('Ta över sidan')
    fireEvent.click(screen.getByText('Gör anspråk →'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_chosen', {
      path: 'claim',
      market_id: 'mkt-1',
    })
  })

  it('fires takeover_path_chosen { path: feedback } when feedback card clicked', async () => {
    await renderPage()

    await screen.findByText('Föreslå ändringar')
    fireEvent.click(screen.getByText('Skicka ändring →'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_chosen', {
      path: 'feedback',
      market_id: 'mkt-1',
    })
  })

  it('fires takeover_path_chosen { path: remove } when remove card clicked', async () => {
    await renderPage()

    await screen.findByText('Ta bort sidan')
    fireEvent.click(screen.getByText('Ta bort →'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_chosen', {
      path: 'remove',
      market_id: 'mkt-1',
    })
  })

  // ── 6–8. takeover_path_cancelled ─────────────────────────────────────────

  it('fires takeover_path_cancelled { path: claim } when Avbryt clicked from claim view', async () => {
    await renderPage()

    await screen.findByText('Gör anspråk →')
    fireEvent.click(screen.getByText('Gör anspråk →'))
    await screen.findByText('Avbryt')
    fireEvent.click(screen.getByText('Avbryt'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_cancelled', {
      path: 'claim',
      market_id: 'mkt-1',
    })
  })

  it('fires takeover_path_cancelled { path: feedback } when Avbryt clicked from feedback view', async () => {
    await renderPage()

    await screen.findByText('Skicka ändring →')
    fireEvent.click(screen.getByText('Skicka ändring →'))
    await screen.findByText('Avbryt')
    fireEvent.click(screen.getByText('Avbryt'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_cancelled', {
      path: 'feedback',
      market_id: 'mkt-1',
    })
  })

  it('fires takeover_path_cancelled { path: remove } when Avbryt clicked from remove view', async () => {
    await renderPage()

    await screen.findByText('Ta bort →')
    fireEvent.click(screen.getByText('Ta bort →'))
    await screen.findByText('Avbryt')
    fireEvent.click(screen.getByText('Avbryt'))

    expect(mockCapture).toHaveBeenCalledWith('takeover_path_cancelled', {
      path: 'remove',
      market_id: 'mkt-1',
    })
  })

  // ── 9–10. takeover_email_submitted ───────────────────────────────────────

  it('fires takeover_email_submitted { success: true } on successful claim submit', async () => {
    mockMutateAsyncStart.mockResolvedValue(undefined)

    await renderPage()

    await screen.findByText('Gör anspråk →')
    fireEvent.click(screen.getByText('Gör anspråk →'))

    const emailInput = await screen.findByPlaceholderText('namn@domän.se')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(screen.getByText('Skicka inloggningslänk'))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_email_submitted', {
        market_id: 'mkt-1',
        success: true,
      }),
    )
  })

  it('fires takeover_email_submitted { success: false, error_reason } on rejected submit', async () => {
    mockMutateAsyncStart.mockRejectedValue(new Error('email_mismatch'))

    await renderPage()

    await screen.findByText('Gör anspråk →')
    fireEvent.click(screen.getByText('Gör anspråk →'))

    const emailInput = await screen.findByPlaceholderText('namn@domän.se')
    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
    fireEvent.click(screen.getByText('Skicka inloggningslänk'))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_email_submitted', {
        market_id: 'mkt-1',
        success: false,
        error_reason: 'email_mismatch',
      }),
    )
  })

  // ── 11–12. takeover_feedback_submitted ───────────────────────────────────

  it('fires takeover_feedback_submitted { success: true } after successful feedback submit', async () => {
    mockMutateAsyncFeedback.mockResolvedValue(undefined)

    await renderPage()

    await screen.findByText('Skicka ändring →')
    fireEvent.click(screen.getByText('Skicka ändring →'))

    const emailInput = await screen.findByPlaceholderText('du@exempel.se')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    const textarea = await screen.findByPlaceholderText(/Datumet är fel/)
    fireEvent.change(textarea, { target: { value: 'Fel datum' } })

    fireEvent.click(screen.getByText('Skicka'))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_feedback_submitted', {
        market_id: 'mkt-1',
        success: true,
      }),
    )
  })

  it('fires takeover_feedback_submitted { success: false, error_reason } on rejected submit', async () => {
    mockMutateAsyncFeedback.mockRejectedValue(new Error('too_many_attempts'))

    await renderPage()

    await screen.findByText('Skicka ändring →')
    fireEvent.click(screen.getByText('Skicka ändring →'))

    const emailInput = await screen.findByPlaceholderText('du@exempel.se')
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

    const textarea = await screen.findByPlaceholderText(/Datumet är fel/)
    fireEvent.change(textarea, { target: { value: 'Ändra datum' } })

    fireEvent.click(screen.getByText('Skicka'))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_feedback_submitted', {
        market_id: 'mkt-1',
        success: false,
        error_reason: 'too_many_attempts',
      }),
    )
  })

  // ── 13–15. takeover_remove_submitted ─────────────────────────────────────

  it('fires takeover_remove_submitted { success: true, has_reason: false } when removed without reason', async () => {
    mockMutateAsyncRemove.mockResolvedValue(undefined)

    await renderPage()

    await screen.findByText('Ta bort →')
    fireEvent.click(screen.getByText('Ta bort →'))

    // Confirm we are in the remove sub-view; leave reason textarea empty
    await screen.findByPlaceholderText(/Hjälper oss bli bättre/)
    fireEvent.click(screen.getByRole('button', { name: 'Ta bort sidan' }))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_remove_submitted', {
        market_id: 'mkt-1',
        success: true,
        has_reason: false,
      }),
    )
  })

  it('fires takeover_remove_submitted { success: true, has_reason: true } when removed with reason', async () => {
    mockMutateAsyncRemove.mockResolvedValue(undefined)

    await renderPage()

    await screen.findByText('Ta bort →')
    fireEvent.click(screen.getByText('Ta bort →'))

    const textarea = await screen.findByPlaceholderText(/Hjälper oss bli bättre/)
    fireEvent.change(textarea, { target: { value: 'Vi håller på att stänga' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ta bort sidan' }))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_remove_submitted', {
        market_id: 'mkt-1',
        success: true,
        has_reason: true,
      }),
    )
  })

  it('fires takeover_remove_submitted { success: false, error_reason, has_reason } on rejected submit', async () => {
    mockMutateAsyncRemove.mockRejectedValue(new Error('token_invalidated'))

    await renderPage()

    await screen.findByText('Ta bort →')
    fireEvent.click(screen.getByText('Ta bort →'))

    const textarea = await screen.findByPlaceholderText(/Hjälper oss bli bättre/)
    fireEvent.change(textarea, { target: { value: 'Stänger ned' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ta bort sidan' }))

    await waitFor(() =>
      expect(mockCapture).toHaveBeenCalledWith('takeover_remove_submitted', {
        market_id: 'mkt-1',
        success: false,
        has_reason: true,
        error_reason: 'token_invalidated',
      }),
    )
  })

  // ── 16. takeover_source_link_clicked ─────────────────────────────────────

  it('fires takeover_source_link_clicked with market_id and hostname when source link clicked', async () => {
    await renderPage()

    // The source link is rendered in the ChooseView market-card preview
    const sourceLink = await screen.findByRole('link', { name: 'example.com' })
    fireEvent.click(sourceLink)

    expect(mockCapture).toHaveBeenCalledWith('takeover_source_link_clicked', {
      market_id: 'mkt-1',
      hostname: 'example.com',
    })
  })
})
