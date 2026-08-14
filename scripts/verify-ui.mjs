#!/usr/bin/env node
/**
 * `pnpm verify:ui` — responsive runtime evidence (CAP-RESPONSIVE-001).
 *
 * Drives the REAL built app in a REAL browser against the REAL local database.
 * For every route × viewport it records: render status, runtime console errors,
 * horizontal overflow, tap-target violations, and a screenshot.
 *
 * Exit code is the verdict. A screenshot without a passing check is decoration,
 * not evidence.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from '@playwright/test'

import {
  computeCandidateId,
  ensureDir,
  loginThroughUi,
  PREVIEW_URL,
  ROUTES,
  seedStudent,
  startPreview,
  supabaseStatus,
  VIEWPORTS,
} from './lib/harness.mjs'

const candidate = computeCandidateId()
const outDir = ensureDir(join('evidence', 'ui', candidate))

/** Console noise that is not the app's fault and would only create false failures. */
const IGNORED_CONSOLE = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /Failed to load resource.*fonts\.g/i,
]

function isRealError(text) {
  return !IGNORED_CONSOLE.some((pattern) => pattern.test(text))
}

async function main() {
  const status = supabaseStatus()
  // Acquire INSIDE the try: if a later acquisition throws, the earlier one still
  // has to be released, or the preview server keeps port 4173 and the test user
  // survives forever.
  let student = null
  let preview = null
  let browser = null

  const results = []
  let failures = 0

  try {
    student = await seedStudent(status, 'ui')
    preview = await startPreview()
    browser = await chromium.launch()

    // Log in once at desktop, reuse the storage state everywhere else.
    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const authPage = await authContext.newPage()
    await loginThroughUi(authPage, student)
    const storageState = await authContext.storageState()
    await authContext.close()

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState,
        deviceScaleFactor: 1,
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires',
        hasTouch: viewport.kind === 'mobile',
      })

      for (const route of ROUTES) {
        const page = await context.newPage()
        const consoleErrors = []
        const pageErrors = []

        page.on('console', (message) => {
          if (message.type() === 'error' && isRealError(message.text())) {
            consoleErrors.push(message.text())
          }
        })
        page.on('pageerror', (error) => pageErrors.push(error.message))

        let rendered = false
        let overflow = null
        let smallTargets = []
        let errorBanner = null

        try {
          const response = await page.goto(`${PREVIEW_URL}${route.path}`, {
            waitUntil: 'networkidle',
            timeout: 30_000,
          })

          // "Rendered" means the main landmark actually has content, not that a
          // 200 came back with an empty shell.
          await page.waitForSelector('main', { timeout: 15_000 })
          await page.waitForFunction(
            () => (document.querySelector('main')?.textContent ?? '').trim().length > 0,
            { timeout: 15_000 },
          )
          rendered = response !== null && response.ok()

          // A React Query failure renders ErrorState (role="alert") without throwing
          // or writing to console, so "main has text" would otherwise pass on the
          // words "No pudimos cargar esto".
          errorBanner = await page.evaluate(() => {
            const alert = document.querySelector('main [role="alert"]')
            return alert ? (alert.textContent ?? '').trim().slice(0, 160) : null
          })

          overflow = await page.evaluate(() => {
            const doc = document.documentElement
            return {
              scrollWidth: doc.scrollWidth,
              clientWidth: doc.clientWidth,
              overflows: doc.scrollWidth > doc.clientWidth + 1,
            }
          })

          // Tap targets only matter where fingers are.
          if (viewport.kind === 'mobile') {
            smallTargets = await page.evaluate(() => {
              const found = []
              const nodes = document.querySelectorAll(
                'a[href], button:not([disabled]), input, select',
              )
              for (const node of nodes) {
                const rect = node.getBoundingClientRect()
                if (rect.width === 0 && rect.height === 0) continue
                const style = getComputedStyle(node)
                if (style.visibility === 'hidden' || style.display === 'none') continue
                if (rect.height < 24 || rect.width < 24) {
                  found.push({
                    tag: node.tagName.toLowerCase(),
                    text: (node.textContent ?? '').trim().slice(0, 40),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  })
                }
              }
              return found
            })
          }

          await page.screenshot({
            path: join(outDir, `${route.name}-${viewport.name}.png`),
            fullPage: false,
          })
        } catch (error) {
          pageErrors.push(error instanceof Error ? error.message : String(error))
        }

        const passed =
          rendered &&
          errorBanner === null &&
          consoleErrors.length === 0 &&
          pageErrors.length === 0 &&
          overflow !== null &&
          !overflow.overflows

        if (!passed) failures += 1

        results.push({
          route: route.path,
          viewport: viewport.name,
          rendered,
          overflow,
          consoleErrors,
          pageErrors,
          smallTargets,
          errorBanner,
          screenshot: `${route.name}-${viewport.name}.png`,
          passed,
        })

        const mark = passed ? '✔' : '✖'
        const detail = passed
          ? ''
          : ` (${[
              !rendered ? 'no render' : null,
              errorBanner ? `error state rendered: "${errorBanner}"` : null,
              overflow?.overflows
                ? `overflow ${overflow.scrollWidth}>${overflow.clientWidth}`
                : null,
              consoleErrors.length ? `${consoleErrors.length} console error(s)` : null,
              pageErrors.length ? `${pageErrors.length} page error(s)` : null,
            ]
              .filter(Boolean)
              .join(', ')})`
        console.log(`  ${mark} ${route.path.padEnd(10)} ${viewport.name}${detail}`)
      }

      await context.close()
    }
  } finally {
    if (browser) await browser.close()
    preview?.stop()
    if (student) await student.cleanup()
  }

  const report = {
    candidate,
    generatedAt: new Date().toISOString(),
    viewports: VIEWPORTS.map((v) => v.name),
    routes: ROUTES.map((r) => r.path),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: failures,
    results,
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))

  console.log(
    `\nverify:ui  candidate=${candidate}  ${report.passed}/${report.total} checks passed  → ${outDir}/report.json`,
  )

  if (failures > 0) {
    console.error(`verify:ui FAILED — ${failures} route/viewport combination(s) did not pass.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`verify:ui crashed: ${error.stack ?? error.message}`)
  process.exit(1)
})
