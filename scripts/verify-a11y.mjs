#!/usr/bin/env node
/**
 * `pnpm verify:a11y` — accessibility evidence (CAP-A11Y-001).
 *
 * Runs axe-core against the REAL rendered app, not a linter approximating one.
 *
 *   critical > 0  → BLOCK
 *   serious  > 0  → BLOCK
 *   moderate/minor → recorded, triaged, non-blocking for the POC
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
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
} from './lib/harness.mjs'

const candidate = computeCandidateId()
const outDir = ensureDir(join('evidence', 'a11y', candidate))

/** One mobile and one desktop viewport per route, as the quality profile requires. */
const SCAN_VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
]

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function main() {
  const status = supabaseStatus()
  const student = await seedStudent(status, 'a11y')
  const preview = await startPreview()
  const browser = await chromium.launch()

  const scans = []
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 }

  try {
    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const authPage = await authContext.newPage()
    await loginThroughUi(authPage, student)
    const storageState = await authContext.storageState()
    await authContext.close()

    for (const viewport of SCAN_VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState,
        locale: 'es-AR',
        timezoneId: 'America/Argentina/Buenos_Aires',
      })
      const page = await context.newPage()

      for (const route of ROUTES) {
        await page.goto(`${PREVIEW_URL}${route.path}`, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        })
        await page.waitForSelector('main', { timeout: 15_000 })
        await page.waitForFunction(
          () => (document.querySelector('main')?.textContent ?? '').trim().length > 0,
          { timeout: 15_000 },
        )

        const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()

        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 }
        const violations = result.violations.map((violation) => {
          const impact = violation.impact ?? 'minor'
          counts[impact] = (counts[impact] ?? 0) + 1
          totals[impact] = (totals[impact] ?? 0) + 1
          return {
            id: violation.id,
            impact,
            help: violation.help,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.slice(0, 4).map((node) => ({
              target: node.target.join(' '),
              summary: (node.failureSummary ?? '').split('\n').slice(0, 3).join(' '),
            })),
          }
        })

        scans.push({ route: route.path, viewport: viewport.name, counts, violations })

        const blocking = counts.critical + counts.serious
        const mark = blocking === 0 ? '✔' : '✖'
        console.log(
          `  ${mark} ${route.path.padEnd(10)} ${viewport.name}  ` +
            `critical=${counts.critical} serious=${counts.serious} ` +
            `moderate=${counts.moderate} minor=${counts.minor}`,
        )
        for (const violation of violations) {
          if (violation.impact === 'critical' || violation.impact === 'serious') {
            console.log(`        ↳ [${violation.impact}] ${violation.id}: ${violation.help}`)
            for (const node of violation.nodes) console.log(`          ${node.target}`)
          }
        }
      }

      await context.close()
    }
  } finally {
    await browser.close()
    preview.stop()
    await student.cleanup()
  }

  const blocking = totals.critical + totals.serious
  const report = {
    candidate,
    generatedAt: new Date().toISOString(),
    engine: 'axe-core via @axe-core/playwright',
    tags: TAGS,
    policy: 'critical>0 or serious>0 blocks',
    totals,
    blocking,
    scans,
  }
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))

  console.log(
    `\nverify:a11y  candidate=${candidate}  ` +
      `critical=${totals.critical} serious=${totals.serious} ` +
      `moderate=${totals.moderate} minor=${totals.minor}  → ${outDir}/report.json`,
  )

  if (blocking > 0) {
    console.error(`verify:a11y FAILED — ${blocking} critical/serious violation(s).`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`verify:a11y crashed: ${error.stack ?? error.message}`)
  process.exit(1)
})
