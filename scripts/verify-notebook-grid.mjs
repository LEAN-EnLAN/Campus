/**
 * The notebook baseline grid, measured in a real browser.
 *
 * The ruling is a background gradient and the text is a stack of line boxes.
 * Nothing in the type system, and nothing in jsdom, notices when those two
 * stop agreeing — the unit suite has no layout. So the guarantee is asserted
 * here, against real rendered geometry:
 *
 *   every .cm-line starts at an exact multiple of --rule-height,
 *   and is exactly one rule tall.
 *
 * It has been broken three different ways already: a ratio line-height that
 * did not divide the rule, a half-rule of padding that offset the whole
 * document, and a heading whose larger inline box seated its baseline one
 * pixel lower and compounded the drift per heading. Each one looks fine in a
 * screenshot of the first two lines.
 */
import { chromium } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { startDevServer, waitForPortFree } from './lib/dev-server.mjs'

const VAULT = process.env.CAMPUS_VAULT ?? join(process.env.HOME, 'Documents/CampusVault')
// CAMPUS_PROFILE reuses a browser profile that already holds an open vault.
// Worth having: the vault a session remembers is device-scoped, so a throwaway
// profile has to walk the opener every run, and this check is about layout —
// it should not fail for reasons that live in the startup flow.
const reusedProfile = process.env.CAMPUS_PROFILE
const profile = reusedProfile ?? mkdtempSync(join(tmpdir(), 'campus-grid-'))

/**
 * A scratch note this check owns, written and removed here.
 *
 * The first version of this typed into the student's daily note, and autosave
 * committed it to disk — a verification script is not allowed to edit the data
 * it verifies against. It also made the assertions depend on whatever that note
 * happened to contain. These four lines are the shapes that pull text off the
 * ruling: a heading (larger font), inline code (different family), a list mark
 * and plain prose.
 */
const SCRATCH = 'campus-grid-check.md'
const SCRATCH_BODY = [
  '## Parcial de Analisis',
  'un `snippet` en linea',
  '- [ ] item de lista',
  'texto comun que ocupa un renglon entero del cuaderno',
  '',
].join('\n')
writeFileSync(join(VAULT, SCRATCH), SCRATCH_BODY)

const fail = (message) => {
  console.error(`FAIL  ${message}`)
  process.exitCode = 1
}

// Attach to a dev server that is already serving (a tailnet session, someone's
// `pnpm dev`) instead of fighting it for the port; start one only if asked to.
const existing = process.env.CAMPUS_URL
const server = existing
  ? { url: existing, ready: true, stop: async () => {} }
  : await (async () => {
      await waitForPortFree(5173)
      return startDevServer({
        args: ['dev'],
        // Point Supabase at a closed port: this check is about local layout,
        // and a real cloud round-trip would make it flaky for no gain.
        env: { VITE_SUPABASE_URL: 'http://127.0.0.1:1', VITE_SUPABASE_ANON_KEY: 'offline' },
      })
    })()
if (!server.ready) {
  console.error('FAIL  dev server did not start\n', server.output.slice(-400))
  process.exit(1)
}

const ctx = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 1440, height: 900 },
})
const page = ctx.pages()[0]

try {
  // A session may already hold a vault, so ask the workspace first and walk the
  // opener only when it shows the chooser. The waits are explicit rather than
  // locator timeouts because the answer here is "which screen rendered", and
  // probing that mid-hydration reports the wrong one.
  const explorer = page.getByLabel('Archivos del Vault')
  const opener = page.getByLabel('Ruta de la carpeta')
  await page.goto(`${server.url}/vault`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  if (await opener.isVisible().catch(() => false)) {
    await opener.fill(VAULT)
    await page.getByRole('button', { name: 'Abrir', exact: true }).click()
    // Wait on the workspace, not on a URL: where the app lands after opening a
    // vault is a product decision this check has no business encoding.
    await page.waitForTimeout(3000)
    await page.goto(`${server.url}/vault`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
  }
  if (!(await explorer.isVisible().catch(() => false))) {
    console.error(`FAIL  no workspace at ${server.url}/vault — the session has no vault open`)
    process.exit(1)
  }

  // The explorer labels notes without their extension.
  await explorer.getByText(SCRATCH.replace(/\.md$/, ''), { exact: true }).first().click()
  await page.getByTestId('note-editor').waitFor({ timeout: 15_000 })
  await page.waitForTimeout(1500)

  const measured = await page.evaluate(() => {
    const rule =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rule-height')) *
      16
    const scroller = document.querySelector('.cm-scroller')
    const content = document.querySelector('.cm-content')
    const origin = content.getBoundingClientRect().top
    return {
      rule,
      // The ruling must travel with the text, not with the border box.
      attachment: getComputedStyle(scroller).backgroundAttachment,
      // A workspace the PAGE scrolls is a workspace with no frame: its header
      // and status bar slide away with the note. What proves the frame is that
      // the scroller is bounded by the viewport instead of growing with the
      // document — asserting that it actually overflows would only be testing
      // whether today's note happens to be long enough.
      pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      scrollerHeight: scroller.clientHeight,
      viewport: window.innerHeight,
      padTop: parseFloat(getComputedStyle(content).paddingTop),
      lines: [...content.querySelectorAll('.cm-line')].map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          text: (el.textContent || '(vacia)').slice(0, 24),
          top: +(rect.top - origin).toFixed(2),
          height: +rect.height.toFixed(2),
        }
      }),
    }
  })

  const { rule, lines } = measured
  if (!measured.attachment.split(',').every((v) => v.trim() === 'local')) {
    fail(
      `the ruling is painted with background-attachment: ${measured.attachment}, not local — it desyncs on scroll`,
    )
  }
  if (measured.pageScrolls)
    fail('the page scrolls: the workspace is not bounded by the viewport')
  if (measured.scrollerHeight > measured.viewport) {
    fail(
      `the editor grew to ${measured.scrollerHeight}px inside a ${measured.viewport}px viewport — it formed no scroll box`,
    )
  }
  if (measured.padTop % rule !== 0) fail(`padding-top ${measured.padTop}px is not a whole rule`)

  const off = lines.filter((l) => l.top % rule !== 0 || l.height % rule !== 0)
  for (const l of off) {
    fail(`"${l.text}" sits at ${l.top}px and is ${l.height}px tall — rule is ${rule}px`)
  }
  console.log(
    process.exitCode
      ? `\n${off.length}/${lines.length} lines off the ${rule}px grid`
      : `OK    ${lines.length} lines, all on the ${rule}px grid, ruling scrolls with the text`,
  )
} finally {
  await ctx.close()
  await server.stop()
  rmSync(join(VAULT, SCRATCH), { force: true })
  if (!reusedProfile) rmSync(profile, { recursive: true, force: true })
}
