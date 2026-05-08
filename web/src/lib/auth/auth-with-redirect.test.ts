import { describe, it, expect, vi } from 'vitest'
import type { AuthPort } from '@fyndstigen/shared/ports/auth'
import { wrapAuth } from './auth-with-redirect'

function makePort(): AuthPort & { _spies: Record<string, ReturnType<typeof vi.fn>> } {
  const spies = {
    getSession: vi.fn(async () => ({ user: null })),
    onAuthStateChange: vi.fn(() => () => {}),
    signIn: vi.fn(async () => undefined),
    signUp: vi.fn(async () => ({ needsEmailConfirmation: false })),
    signInWithGoogle: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    resetPasswordForEmail: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
  }
  return { ...spies, _spies: spies }
}

describe('wrapAuth', () => {
  it('signUp injects `${origin}/auth` as emailRedirectTo', async () => {
    const port = makePort()
    const wrapped = wrapAuth(port, () => 'https://app.example.com')
    await wrapped.signUp('a@b.com', 'pw', { firstName: 'Eva' })
    expect(port._spies.signUp).toHaveBeenCalledWith(
      'a@b.com',
      'pw',
      { firstName: 'Eva' },
      'https://app.example.com/auth',
    )
  })

  it('resetPasswordForEmail injects `${origin}/auth/reset-password`', async () => {
    const port = makePort()
    const wrapped = wrapAuth(port, () => 'https://app.example.com')
    await wrapped.resetPasswordForEmail('a@b.com')
    expect(port._spies.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.com',
      'https://app.example.com/auth/reset-password',
    )
  })

  it('uses originProvider lazily so each call reads the current origin', async () => {
    const port = makePort()
    let origin = 'https://staging.example.com'
    const wrapped = wrapAuth(port, () => origin)

    await wrapped.signUp('a@b.com', 'pw')
    expect(port._spies.signUp).toHaveBeenLastCalledWith(
      'a@b.com', 'pw', undefined, 'https://staging.example.com/auth',
    )

    origin = 'https://app.example.com'
    await wrapped.signUp('a@b.com', 'pw')
    expect(port._spies.signUp).toHaveBeenLastCalledWith(
      'a@b.com', 'pw', undefined, 'https://app.example.com/auth',
    )
  })

  it('signIn passes through unchanged', async () => {
    const port = makePort()
    const wrapped = wrapAuth(port, () => 'irrelevant')
    await wrapped.signIn('a@b.com', 'pw')
    expect(port._spies.signIn).toHaveBeenCalledWith('a@b.com', 'pw')
  })

  it('signInWithGoogle passes through unchanged (port handles redirect)', async () => {
    const port = makePort()
    const wrapped = wrapAuth(port, () => 'irrelevant')
    await wrapped.signInWithGoogle('https://example.com/cb')
    expect(port._spies.signInWithGoogle).toHaveBeenCalledWith('https://example.com/cb')
  })

  it('signOut, updatePassword, getSession, onAuthStateChange pass through', async () => {
    const port = makePort()
    const wrapped = wrapAuth(port, () => 'irrelevant')
    await wrapped.signOut()
    await wrapped.updatePassword('newpw')
    await wrapped.getSession()
    wrapped.onAuthStateChange(() => {})
    expect(port._spies.signOut).toHaveBeenCalled()
    expect(port._spies.updatePassword).toHaveBeenCalledWith('newpw')
    expect(port._spies.getSession).toHaveBeenCalled()
    expect(port._spies.onAuthStateChange).toHaveBeenCalled()
  })
})
