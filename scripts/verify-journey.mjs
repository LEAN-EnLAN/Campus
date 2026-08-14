#!/usr/bin/env node
/**
 * `pnpm verify:journey` — the POC's success condition, driven through the real UI.
 *
 *   sign up → onboarding → elegir universidad/facultad/carrera/plan → Today
 *   → Plan → marcar una materia en curso → agregar entrega → aparece en Today
 *   → abrir la materia → la entrega está ahí → marcar la materia aprobada
 *   → la disponibilidad de las dependientes se recalcula
 *
 * Every assertion reads the rendered DOM after a real round-trip to Postgres.
 * Nothing is stubbed, nothing is injected: if this passes, a student can do it.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium } from '@playwright/test'

import {
  computeCandidateId,
  ensureDir,
  PREVIEW_URL,
  startPreview,
  supabaseStatus,
} from './lib/harness.mjs'

const candidate = computeCandidateId()
const outDir = ensureDir(join('evidence', 'journey', candidate))

const steps = []
let stepIndex = 0

async function step(page, name, fn) {
  stepIndex += 1
  const started = Date.now()
  try {
    const detail = await fn()
    steps.push({ step: stepIndex, name, passed: true, detail: detail ?? null })
    console.log(`  ✔ ${String(stepIndex).padStart(2)}. ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    steps.push({ step: stepIndex, name, passed: false, detail: message })
    console.log(`  ✖ ${String(stepIndex).padStart(2)}. ${name}\n       ${message}`)
    await page
      ?.screenshot({ path: join(outDir, `FAILED-${stepIndex}.png`), fullPage: true })
      .catch(() => {})
    throw error
  } finally {
    steps[steps.length - 1].ms = Date.now() - started
  }
}

async function main() {
  const status = supabaseStatus()
  // Acquire inside the try so a failure part-way through setup still releases what
  // was already taken — otherwise an orphaned preview keeps port 4173 bound.
  let preview = null
  let browser = null
  let page = null

  const email = `journey-${process.pid}-${Date.now()}@campus.test`
  const password = 'campus-journey-123456'
  let userId = null

  const consoleErrors = []

  try {
    preview = await startPreview()
    browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Buenos_Aires',
    })
    page = await context.newPage()

    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|fonts\.g/i.test(m.text()))
        consoleErrors.push(m.text())
    })
    page.on('pageerror', (e) => consoleErrors.push(e.message))

    // ---- 1. sign up -------------------------------------------------------
    await step(page, 'Crear cuenta', async () => {
      await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
      await page.getByLabel('¿Cómo te llamás?').fill('Camila')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Contraseña').fill(password)
      await page.getByRole('button', { name: 'Crear cuenta' }).click()
      await page.waitForURL(/\/onboarding/, { timeout: 25_000 })
      return email
    })

    // ---- 2. onboarding ----------------------------------------------------
    await step(page, 'Elegir universidad', async () => {
      const option = page.getByRole('radio', { name: /Universidad Tecnológica Nacional/ })
      await option.waitFor({ timeout: 20_000 })
      await option.check()
      return 'UTN'
    })

    await step(page, 'Elegir facultad', async () => {
      const option = page.getByRole('radio', { name: /Facultad Regional Rosario/ })
      await option.waitFor({ timeout: 20_000 })
      await option.check()
      return 'FRRo'
    })

    await step(page, 'Elegir carrera', async () => {
      const option = page.getByRole('radio', { name: /Ingeniería en Sistemas de Información/ })
      await option.waitFor({ timeout: 20_000 })
      await option.check()
      return 'Ingeniería en Sistemas de Información'
    })

    await step(page, 'Elegir plan de estudios', async () => {
      const option = page.getByRole('radio', { name: /Plan 2023/ })
      await option.waitFor({ timeout: 20_000 })
      await option.check()
      return 'Plan 2023'
    })

    await step(page, 'Confirmar y entrar a Hoy', async () => {
      await page.getByRole('button', { name: 'Listo, empezar' }).click()
      await page.waitForURL(/\/today/, { timeout: 25_000 })
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 })
      return await page.getByRole('heading', { level: 1 }).innerText()
    })

    // ---- 3. the plan is real ---------------------------------------------
    let blockedSubjectName = null
    let unlockSubjectName = null

    await step(page, 'Ver el plan real con materias oficiales', async () => {
      await page.getByRole('link', { name: 'Plan', exact: true }).first().click()
      await page.waitForURL(/\/plan/, { timeout: 20_000 })
      await page.getByRole('heading', { name: /1° año/ }).waitFor({ timeout: 20_000 })

      const rows = await page.locator('main ul li a').count()
      if (rows < 30) throw new Error(`el plan trajo solo ${rows} materias`)

      const first = await page.locator('main ul li a').first().innerText()
      if (!/Análisis Matemático I/.test(first)) {
        throw new Error(`la primera materia no es la esperada: ${first.split('\n')[0]}`)
      }
      return `${rows} materias, primera: ${first
        .split('\n')
        .find((l) => l.trim().length > 2)
        ?.trim()}`
    })

    await step(page, 'Ver una materia bloqueada por correlativas', async () => {
      const blocked = page.locator('main ul li a', { hasText: 'Bloqueada' }).first()
      await blocked.waitFor({ timeout: 15_000 })
      const text = await blocked.innerText()
      blockedSubjectName =
        text
          .split('\n')
          .find((l) => l.trim().length > 2)
          ?.trim() ?? '?'
      if (!/falta /.test(text)) throw new Error(`no dice qué correlativa falta: ${text}`)
      return `${blockedSubjectName} — ${text.split('\n')[1]?.trim()}`
    })

    // ---- 4. mark a subject in progress -----------------------------------
    await step(page, 'Abrir Análisis Matemático I y marcarla Cursando', async () => {
      await page.locator('main ul li a', { hasText: 'Análisis Matemático I' }).first().click()
      await page.waitForURL(/\/courses\//, { timeout: 20_000 })
      await page.getByRole('heading', { level: 1 }).waitFor()

      await page.getByLabel('¿Cómo vas?').selectOption('in_progress')
      await page
        .locator('section[aria-labelledby="estado"] p')
        .filter({ hasText: 'Cursando' })
        .waitFor({ timeout: 15_000 })

      const unlocks = page.locator('section[aria-labelledby="correlativas"] ul li a')
      if ((await unlocks.count()) > 0) unlockSubjectName = await unlocks.first().innerText()
      return unlockSubjectName ? `habilita: ${unlockSubjectName}` : 'marcada'
    })

    // ---- 5. capture a deadline -------------------------------------------
    await step(page, 'Agregar una entrega para hoy', async () => {
      await page.getByRole('button', { name: 'Agregar entrega' }).click()
      // Scope every field to the dialog: the page behind it has a "Fechas" region
      // whose accessible name collides with the "Fecha" input.
      const dialog = page.getByRole('dialog')
      await dialog.waitFor({ timeout: 10_000 })
      await dialog.getByLabel('¿Qué es?').fill('TP 1 · integrales')

      const today = new Date()
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      await dialog.getByLabel('Fecha').fill(iso)
      await dialog.getByLabel('Hora').fill('18:00')
      await dialog.getByRole('button', { name: 'Guardar' }).click()
      await dialog.waitFor({ state: 'detached', timeout: 15_000 })
      return iso
    })

    await step(page, 'La entrega aparece en la materia', async () => {
      const row = page.locator('section[aria-labelledby="fechas"]', {
        hasText: 'TP 1 · integrales',
      })
      await row.waitFor({ timeout: 15_000 })
      return 'visible en el detalle de la materia'
    })

    // ---- 6. it shows up in Today (persisted, cross-screen) ----------------
    await step(page, 'La misma entrega aparece en Hoy', async () => {
      await page.getByRole('link', { name: 'Hoy', exact: true }).first().click()
      await page.waitForURL(/\/today/, { timeout: 20_000 })

      const section = page.locator('section[aria-labelledby="hoy"]')
      await section.getByText('TP 1 · integrales', { exact: true }).waitFor({ timeout: 20_000 })

      const heading = await page.getByRole('heading', { level: 1 }).innerText()
      if (!/una cosa|\d+ cosas/.test(heading))
        throw new Error(`el título no cuenta la entrega: ${heading}`)
      return heading
    })

    await step(page, 'La entrega también aparece en el calendario', async () => {
      await page.getByRole('link', { name: 'Calendario', exact: true }).first().click()
      await page.waitForURL(/\/calendar/, { timeout: 20_000 })
      await page
        .getByText('TP 1 · integrales', { exact: true })
        .first()
        .waitFor({ timeout: 20_000 })
      return 'visible en la semana'
    })

    // ---- 7. persistence survives a full reload ---------------------------
    await step(page, 'Todo sobrevive un reload completo', async () => {
      await page.reload({ waitUntil: 'networkidle' })
      await page
        .getByText('TP 1 · integrales', { exact: true })
        .first()
        .waitFor({ timeout: 20_000 })
      return 'datos persistidos en Postgres, no en estado de React'
    })

    // ---- 8. CAP-PLAN-002: passing recalculates dependants ----------------
    let beforeAvailable = 0
    await step(page, 'Contar materias disponibles antes de aprobar', async () => {
      await page.getByRole('link', { name: 'Materias', exact: true }).first().click()
      await page.waitForURL(/\/courses/, { timeout: 20_000 })
      const button = page.getByRole('button', { name: /^Disponibles/ })
      await button.waitFor({ timeout: 20_000 })
      beforeAvailable = Number.parseInt((await button.innerText()).replace(/\D+/g, ''), 10)
      if (!Number.isFinite(beforeAvailable)) throw new Error('no pude leer el contador')
      return `${beforeAvailable} disponibles`
    })

    /**
     * Approve a subject by name, from the "Todas" filter so any status is reachable.
     */
    async function approve(name) {
      // Go through Plan: it lists every subject regardless of status filter.
      await page.getByRole('link', { name: 'Plan', exact: true }).first().click()
      await page.waitForURL(/\/plan/, { timeout: 20_000 })
      await page.getByRole('heading', { name: /1° año/ }).waitFor({ timeout: 20_000 })

      // Match the name span exactly. `hasText` collapses the row's text, so a
      // line-anchored regex cannot separate "Análisis Matemático I" from "… II".
      const row = page
        .locator('main ul li a')
        .filter({ has: page.getByText(name, { exact: true }) })
        .first()
      await row.waitFor({ timeout: 20_000 })
      await row.click()
      await page.waitForURL(/\/courses\//, { timeout: 20_000 })

      await page.getByLabel('¿Cómo vas?').selectOption('passed')
      await page
        .locator('section[aria-labelledby="estado"] p')
        .filter({ hasText: 'Aprobada' })
        .waitFor({ timeout: 15_000 })
    }

    // Análisis Matemático II requires BOTH Análisis Matemático I and Álgebra y
    // Geometría Analítica (Ord. CSU 1878/2022). Approving only one must NOT unlock
    // it — that is the correlativa logic actually being correct, so the test
    // approves both and then asserts the dependant flipped.
    await step(page, 'Aprobar Análisis Matemático I', async () => {
      await approve('Análisis Matemático I')
      return 'aprobada'
    })

    await step(page, 'Con una sola correlativa, la dependiente sigue bloqueada', async () => {
      await page.getByRole('link', { name: 'Plan', exact: true }).first().click()
      await page.waitForURL(/\/plan/, { timeout: 20_000 })
      await page.getByRole('heading', { name: /1° año/ }).waitFor({ timeout: 20_000 })
      const row = page.locator('main ul li a', { hasText: 'Análisis Matemático II' }).first()
      await row.waitFor({ timeout: 20_000 })
      const text = await row.innerText()
      if (!/Bloqueada/.test(text)) {
        throw new Error(`debería seguir bloqueada por Álgebra: ${text.replace(/\n/g, ' · ')}`)
      }
      return 'sigue bloqueada — le falta Álgebra y Geometría Analítica'
    })

    await step(page, 'Aprobar Álgebra y Geometría Analítica', async () => {
      await approve('Álgebra y Geometría Analítica')
      return 'aprobada'
    })

    await step(page, 'La dependiente se habilitó sola (CAP-PLAN-002)', async () => {
      await page.getByRole('link', { name: 'Plan', exact: true }).first().click()
      await page.waitForURL(/\/plan/, { timeout: 20_000 })
      await page.getByRole('heading', { name: /1° año/ }).waitFor({ timeout: 20_000 })

      const row = page.locator('main ul li a', { hasText: 'Análisis Matemático II' }).first()
      await row.waitFor({ timeout: 20_000 })

      let text = ''
      for (let i = 0; i < 30; i += 1) {
        text = await row.innerText()
        if (/Disponible/.test(text)) break
        await page.waitForTimeout(400)
      }
      if (!/Disponible/.test(text)) {
        throw new Error(
          `sigue sin habilitarse tras aprobar ambas correlativas: ${text.replace(/\n/g, ' · ')}`,
        )
      }

      await page.getByRole('link', { name: 'Materias', exact: true }).first().click()
      await page.waitForURL(/\/courses/, { timeout: 20_000 })
      const button = page.getByRole('button', { name: /^Disponibles/ })
      await button.waitFor({ timeout: 20_000 })
      const after = Number.parseInt((await button.innerText()).replace(/\D+/g, ''), 10)

      return `Análisis Matemático II → Disponible · ${beforeAvailable} → ${after} disponibles`
    })

    await step(page, 'Sin errores de runtime en todo el recorrido', async () => {
      if (consoleErrors.length > 0) {
        throw new Error(
          `${consoleErrors.length} error(es): ${consoleErrors.slice(0, 3).join(' | ')}`,
        )
      }
      return '0 errores de consola'
    })

    await page.screenshot({ path: join(outDir, 'journey-final.png'), fullPage: true })
  } finally {
    // Look up the created user so the run leaves nothing behind.
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      // Paginate: a single page silently stops finding the user once the local
      // auth.users table grows past perPage, leaving test accounts behind forever.
      for (let page = 1; page <= 50 && !userId; page += 1) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        const users = data?.users ?? []
        if (users.length === 0) break
        userId = users.find((u) => u.email === email)?.id ?? null
      }
      if (userId) await admin.auth.admin.deleteUser(userId)
    } catch {
      /* cleanup is best-effort */
    }

    if (browser) await browser.close()
    preview?.stop()

    const failed = steps.filter((s) => !s.passed).length
    writeFileSync(
      join(outDir, 'report.json'),
      JSON.stringify(
        {
          candidate,
          generatedAt: new Date().toISOString(),
          total: steps.length,
          passed: steps.length - failed,
          failed,
          consoleErrors,
          steps,
        },
        null,
        2,
      ),
    )
    console.log(
      `\nverify:journey  candidate=${candidate}  ` +
        `${steps.length - failed}/${steps.length} pasos  → ${outDir}/report.json`,
    )
  }
}

main().catch((error) => {
  console.error(`\nverify:journey FAILED: ${error.message}`)
  process.exit(1)
})
