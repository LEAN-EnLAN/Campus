import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
export default defineConfig({
  testDir: '.',
  testMatch: 'cloud.spec.mjs',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 12000 },
  reporter: [
    ['list'],
    ['json', { outputFile: join(process.env.CAMPUS_BLUE_CLOUD_OUTPUT, 'results.json') }],
  ],
  outputDir: join(process.env.CAMPUS_BLUE_CLOUD_OUTPUT, 'trace'),
  use: {
    baseURL: process.env.CAMPUS_BLUE_BASE_URL,
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
})
