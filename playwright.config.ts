import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

// Scripted-hand end-to-end tests (GAME_REVIEW.md §4-B). Chromium renders with
// SwiftShader at roughly 12 FPS at 640×360, so tests wait for smoothing to settle.
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 640, height: 360 },
    permissions: ['camera'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node scripts/fetch-assets.mjs && npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
