import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const isProductCanvasPerformance = process.env.WA_CANVAS_PERFORMANCE_TARGET === 'product'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['html'], ['list']] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'public-editor',
      testMatch: /editor-.*\.spec\.ts/,
      use: devices['Desktop Chrome'],
    },
    {
      name: 'chromium',
      testIgnore: /editor-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: isProductCanvasPerformance
      ? 'vp exec wrangler dev --config dist/server/wrangler.json --port 3000'
      : 'vp dev .',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI && !isProductCanvasPerformance,
    timeout: 120 * 1000,
  },
})
