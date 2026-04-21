import { renderHook, waitFor, act } from '@testing-library/react'
import { useStripeConnect } from './use-stripe-connect'

const mockInvoke = vi.fn()

vi.mock('@/lib/api', () => ({
  api: {
    edge: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}))

describe('useStripeConnect — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.location.href = ''
    mockInvoke.mockResolvedValue({ connected: false, onboarding_complete: false })
  })

  it('does not fetch status when userId is undefined', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    expect(result.current.loading).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  it('does not fetch status when userId is empty string', async () => {
    const { result } = renderHook(() => useStripeConnect(undefined))

    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(false)
    expect(result.current.onboardingComplete).toBe(false)
  })

  it('does not redirect on startOnboarding failure', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: false, onboarding_complete: false })
    mockInvoke.mockRejectedValueOnce(new Error('Stripe API down'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const hrefBefore = window.location.href
    await act(async () => { await result.current.startOnboarding() })

    expect(window.location.href).toBe(hrefBefore)
    expect(result.current.error).toBeTruthy()
  })

  it('does not redirect on refreshOnboarding failure', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: true, onboarding_complete: false })
    mockInvoke.mockRejectedValueOnce(new Error('Account not found'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.refreshOnboarding() })

    expect(result.current.error).toBeTruthy()
  })

  it('clears error when startOnboarding succeeds after failure', async () => {
    mockInvoke.mockResolvedValueOnce({ connected: false, onboarding_complete: false })
    mockInvoke.mockRejectedValueOnce(new Error('Temporary failure'))

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeTruthy()

    mockInvoke.mockResolvedValueOnce({ url: 'https://connect.stripe.com/setup/retry' })

    await act(async () => { await result.current.startOnboarding() })
    expect(result.current.error).toBeNull()
  })

  it('passes correct function names to api.edge.invoke', async () => {
    mockInvoke.mockResolvedValue({ connected: false, onboarding_complete: false })

    const { result } = renderHook(() => useStripeConnect('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-status')

    mockInvoke.mockResolvedValueOnce({ url: 'https://stripe.com' })
    await act(async () => { await result.current.startOnboarding() })
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-create')

    mockInvoke.mockResolvedValueOnce({ url: 'https://stripe.com' })
    await act(async () => { await result.current.refreshOnboarding() })
    expect(mockInvoke).toHaveBeenCalledWith('stripe-connect-refresh')
  })
})
