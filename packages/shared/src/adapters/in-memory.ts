import type { AuthPort, AuthUser } from '../ports/auth'
import type { ServerDataPort } from '../ports/server'

export function createInMemoryAuth(initialUser?: AuthUser): AuthPort {
  let currentUser: AuthUser | null = initialUser ?? null
  const listeners: Array<(user: AuthUser | null) => void> = []

  return {
    async getSession() {
      return { user: currentUser }
    },
    onAuthStateChange(cb) {
      listeners.push(cb)
      return () => {
        const idx = listeners.indexOf(cb)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    },
    async signIn(_email, _password) {
      currentUser = { id: 'test-user', email: _email }
      listeners.forEach((cb) => cb(currentUser))
    },
    async signUp(_email, _password) {
      currentUser = { id: 'test-user', email: _email }
      listeners.forEach((cb) => cb(currentUser))
    },
    async signInWithGoogle() {
      currentUser = { id: 'test-user', email: 'google@test.com' }
      listeners.forEach((cb) => cb(currentUser))
    },
    async signOut() {
      currentUser = null
      listeners.forEach((cb) => cb(null))
    },
  }
}

type MarketMeta = Awaited<ReturnType<ServerDataPort['getMarketMeta']>>
type RouteMeta = Awaited<ReturnType<ServerDataPort['getRouteMeta']>>

export function createInMemoryServerData(seed?: {
  markets?: Array<NonNullable<MarketMeta> & { id: string; updatedAt: string }>
  routes?: Array<NonNullable<RouteMeta> & { id: string; updatedAt: string }>
}): ServerDataPort {
  const markets = seed?.markets ?? []
  const routes = seed?.routes ?? []

  return {
    async getMarketMeta(id) {
      return markets.find((m) => m.id === id) ?? null
    },
    async getRouteMeta(id) {
      return routes.find((r) => r.id === id) ?? null
    },
    async listPublishedMarketIds() {
      return markets.map((m) => ({ id: m.id, updatedAt: m.updatedAt }))
    },
    async listPublishedRouteIds() {
      return routes.map((r) => ({ id: r.id, updatedAt: r.updatedAt }))
    },
  }
}
