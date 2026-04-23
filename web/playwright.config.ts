import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3000)
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`
const IS_CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: IS_CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'smoke',
      testDir: './e2e/smoke',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'map',
      testDir: './e2e/map',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'onboarding',
      testDir: './e2e/onboarding',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Skip auto-start when hitting a remote BASE_URL (e.g. staging smoke runs).
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `node ../node_modules/next/dist/bin/next dev -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !IS_CI,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_E2E_FAKE: process.env.E2E_PROFILE === 'map' ? '1' : '',
        },
      },
})
