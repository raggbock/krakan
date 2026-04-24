// Removed when the first real map test lands (plan 2, task 7).
import { test, expect } from '../helpers/test'

test('map profile scaffold is wired', () => {
  expect(process.env.E2E_PROFILE).toBe('map')
})
