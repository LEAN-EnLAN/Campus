import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const artifacts = process.env.CAMPUS_BLUE_QA_OUTPUT ?? join(tmpdir(), 'campus-blue-qa-direct')

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  timeout: 150_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list'], ['json', { outputFile: join(artifacts, 'results.json') }]],
  outputDir: join(artifacts, 'traces'),
  use: {
    baseURL: process.env.CAMPUS_BLUE_BASE_URL,
    browserName: 'chromium',
    channel: process.env.CAMPUS_BLUE_BROWSER_CHANNEL ?? 'msedge',
    headless: process.env.CAMPUS_BLUE_QA_HEADLESS !== '0',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 25_000,
  },
})
