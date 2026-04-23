import { test as base, expect } from '@playwright/test'

// Shared base test. Per-profile fixtures (asOrganizer / asVisitor, seedMarkets)
// are layered on in the map and onboarding plans.
export const test = base
export { expect }
