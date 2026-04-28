import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

// posthog-js/react reads React via a CJS interop wrapper that resolves to null
// under our jsdom test env. Components only use the hook to call .capture() on
// the returned client (or no-op when null), so a stub is functionally correct.
vi.mock('posthog-js/react', () => ({
  usePostHog: () => null,
  PostHogProvider: ({ children }: { children: ReactNode }) => children,
}))
