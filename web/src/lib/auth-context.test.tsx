import React from 'react'
import { render, renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth, mockGetSession, mockOnAuthStateChange } = vi.hoisted(() => {
  const getSession = vi.fn()
  const onAuthStateChange = vi.fn()
  return {
    mockGetSession: getSession,
    mockOnAuthStateChange: onAuthStateChange,
    mockAuth: {
      getSession,
      onAuthStateChange,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
    },
  }
})

vi.mock('./auth', () => ({ auth: mockAuth }))

import { AuthProvider, useAuth } from './auth-context'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ user: null })
    mockOnAuthStateChange.mockReturnValue(() => {})
  })

  it('returns the auth singleton even outside a provider (no-throw default)', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.auth).toBe(mockAuth)
    expect(result.current.user).toBe(null)
    expect(result.current.loading).toBe(true)
  })

  it('inside provider, exposes user from getSession after resolve', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', email: 'a@b.com' } })

    function Probe() {
      const { user, loading } = useAuth()
      return <div data-testid="probe">{loading ? 'loading' : user?.email ?? 'none'}</div>
    }

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(getByTestId('probe').textContent).toBe('a@b.com'))
  })

  it('subscribes to auth state changes and updates user', async () => {
    let cb: ((u: { id: string; email: string } | null) => void) | undefined
    mockOnAuthStateChange.mockImplementation((fn: (u: { id: string; email: string } | null) => void) => {
      cb = fn
      return () => {}
    })

    function Probe() {
      const { user } = useAuth()
      return <div data-testid="probe">{user?.email ?? 'none'}</div>
    }

    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(mockOnAuthStateChange).toHaveBeenCalled())
    expect(cb).toBeDefined()

    cb!({ id: 'u2', email: 'b@c.com' })
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('b@c.com'))
  })
})
