import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// WP1 "Compartir": two seeded Cloud accounts on different plans (`pnpm tester`
// against the LOCAL Supabase), a Vite dev server at CAMPUS_BLUE_BASE_URL.
const artifacts = process.env.CAMPUS_BLUE_SHARE_OUTPUT ?? join(tmpdir(), 'campus-blue-share')

export default defineConfig({
  testDir: '.',
  testMatch: 'share.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 12000 },
  reporter: [['list'], ['json', { outputFile: join(artifacts, 'results.json') }]],
  outputDir: join(artifacts, 'trace'),
  use: {
    baseURL: process.env.CAMPUS_BLUE_BASE_URL,
    browserName: 'chromium',
    channel: process.env.CAMPUS_BLUE_BROWSER_CHANNEL ?? 'msedge',
    headless: true,
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
})
