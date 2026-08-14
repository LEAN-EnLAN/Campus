#!/usr/bin/env node
/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TESTER TOOLING — temporary. See docs/TESTING.md § "Cómo sacar esto".   │
 * │  Deleting this file, src/routes/dev.tsx and the two `tester*` scripts   │
 * │  in package.json removes the entire feature. No app code depends on it. │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Seeds named test accounts with fixed credentials so every frontend state —
 * including the ones blocked by missing UNR/UTN data — is reachable in one click.
 *
 *   pnpm tester seed    idempotent: create or refresh every scenario
 *   pnpm tester list    print the table of accounts
 *   pnpm tester purge   delete every tester account and its data
 *
 * Only ever talks to the LOCAL stack. It refuses to run against anything else.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import process from 'node:process'

export const TESTER_PASSWORD = 'campus-tester'
const EMAIL_DOMAIN = 'tester.campus.local'

/**
 * Every scenario the frontend can be in. `build` receives the resolved
 * curriculum and returns the rows to insert, so a scenario is data, not code.
 */
export const SCENARIOS = [
  {
    key: 'nuevo',
    title: 'Cuenta nueva, sin carrera',
    covers: 'onboarding forzado · CAP-ONBOARD-001',
    plan: null,
    build: () => ({}),
  },
  {
    key: 'unmapped',
    title: 'Carrera que no tenemos',
    covers: 'CAP-ONBOARD-002 · Plan degradado honestamente',
    plan: 'unmapped',
    build: () => ({}),
  },
  {
    key: 'utn-vacio',
    title: 'UTN, recién arrancando',
    covers: 'empty states en Hoy, Calendario y Material',
    plan: 'utn',
    build: () => ({}),
  },
  {
    key: 'utn-activo',
    title: 'UTN, cursando 3 materias',
    covers: 'Hoy poblado, atrasadas, correlativas satisfechas',
    plan: 'utn',
    build: ({ byYear }) => ({
      states: [
        ...byYear(1)
          .slice(0, 6)
          .map((s) => ({ id: s.id, status: 'passed' })),
        ...byYear(1)
          .slice(6, 8)
          .map((s) => ({ id: s.id, status: 'regularized' })),
        ...byYear(2)
          .slice(0, 3)
          .map((s) => ({ id: s.id, status: 'in_progress' })),
      ],
      items: [
        { offsetDays: -3, hour: 18, kind: 'assignment', title: 'TP 2 · atrasado', subject: 0 },
        { offsetDays: 0, hour: 9, kind: 'class', title: 'Teoría', subject: 0 },
        { offsetDays: 0, hour: 18, kind: 'assignment', title: 'TP 4 · entrega', subject: 1 },
        { offsetDays: 1, hour: 8, kind: 'midterm', title: 'Primer parcial', subject: 2 },
        {
          offsetDays: 4,
          hour: 20,
          kind: 'assignment',
          title: 'Informe de laboratorio',
          subject: 1,
        },
        { offsetDays: 21, hour: 9, kind: 'final', title: 'Final', subject: 0 },
        {
          offsetDays: null,
          hour: null,
          kind: 'task',
          title: 'Pedir apuntes a Belén',
          subject: null,
        },
      ],
      resources: [
        {
          kind: 'link',
          title: 'Drive de la cátedra',
          url: 'https://example.org/drive',
          subject: 0,
        },
        { kind: 'link', title: 'Guía de TPs', url: 'https://example.org/tps', subject: 1 },
        {
          kind: 'note',
          title: 'Fórmulas que siempre olvido',
          body: 'Integración por partes: ∫u dv = uv − ∫v du',
          subject: 0,
        },
      ],
    }),
  },
  {
    key: 'utn-avanzado',
    title: 'UTN, último año',
    covers: 'progreso alto, casi todo desbloqueado, desaprobada y equivalencia',
    plan: 'utn',
    build: ({ all }) => ({
      states: [
        ...all()
          .slice(0, 26)
          .map((s) => ({ id: s.id, status: 'passed' })),
        ...all()
          .slice(26, 28)
          .map((s) => ({ id: s.id, status: 'equivalent' })),
        ...all()
          .slice(28, 29)
          .map((s) => ({ id: s.id, status: 'failed' })),
        ...all()
          .slice(29, 32)
          .map((s) => ({ id: s.id, status: 'in_progress' })),
      ],
      items: [
        {
          offsetDays: 2,
          hour: 14,
          kind: 'registration',
          title: 'Inscripción a finales',
          subject: null,
        },
        { offsetDays: 9, hour: 9, kind: 'final', title: 'Final de Redes', subject: 0 },
      ],
      resources: [],
    }),
  },
  {
    key: 'unr',
    title: 'UNR, plan sin correlativas',
    covers: 'el caso BLOQUEADO: la fuente oficial no publica correlatividades',
    plan: 'unr',
    build: ({ byYear }) => ({
      states: [
        ...byYear(1)
          .slice(0, 4)
          .map((s) => ({ id: s.id, status: 'passed' })),
        ...byYear(2)
          .slice(0, 2)
          .map((s) => ({ id: s.id, status: 'in_progress' })),
      ],
      items: [
        {
          offsetDays: 0,
          hour: 16,
          kind: 'assignment',
          title: 'Entrega de Algoritmos',
          subject: 0,
        },
      ],
      resources: [],
    }),
  },
]

export function emailFor(key) {
  return `tester-${key}@${EMAIL_DOMAIN}`
}

function localStatus() {
  const raw = execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const status = JSON.parse(raw)

  // Refuse to touch anything that is not the local stack.
  const url = String(status.API_URL ?? '')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:|$)/.test(url)) {
    console.error(`[tester] refusing to run against a non-local API: ${url}`)
    process.exit(1)
  }
  return status
}

async function adminClient(status) {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function findUser(admin, email) {
  for (let page = 1; page <= 50; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const users = data?.users ?? []
    if (users.length === 0) return null
    const found = users.find((u) => u.email === email)
    if (found) return found
  }
  return null
}

async function loadCurriculum(admin, version) {
  const { data, error } = await admin
    .from('curricula')
    .select('id, version, curriculum_subjects (id, year_level, display_order)')
    .eq('version', version)
    .single()
  if (error) throw new Error(`curriculum "${version}" not seeded: ${error.message}`)

  const sorted = [...data.curriculum_subjects].sort(
    (a, b) => a.year_level - b.year_level || a.display_order - b.display_order,
  )
  return {
    id: data.id,
    all: () => sorted,
    byYear: (year) => sorted.filter((s) => s.year_level === year),
  }
}

const PLAN_VERSION = { utn: 'Plan 2023', unr: 'TO 2024' }

async function seedScenario(admin, scenario, curricula) {
  const email = emailFor(scenario.key)

  // Idempotent: drop and recreate so a re-seed always yields the same state.
  const existing = await findUser(admin, email)
  if (existing) await admin.auth.admin.deleteUser(existing.id)

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: TESTER_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: scenario.title },
  })
  if (error) throw new Error(`could not create ${email}: ${error.message}`)
  const userId = created.user.id

  try {
    if (scenario.plan === 'unmapped') {
      await admin.from('user_academic_contexts').insert({
        user_id: userId,
        unmapped_label: 'Ingeniería Industrial — UNC',
        is_active: true,
      })
      return { email, userId, rows: 1 }
    }

    if (scenario.plan === null) return { email, userId, rows: 0 }

    const curriculum = curricula[scenario.plan]
    await admin.from('user_academic_contexts').insert({
      user_id: userId,
      curriculum_id: curriculum.id,
      is_active: true,
    })

    const spec = scenario.build(curriculum)
    let rows = 1

    if (spec.states?.length) {
      const unique = new Map(spec.states.map((s) => [s.id, s]))
      await admin.from('user_subject_states').insert(
        [...unique.values()].map((s) => ({
          user_id: userId,
          curriculum_subject_id: s.id,
          status: s.status,
          grade: s.status === 'passed' ? 7 : null,
        })),
      )
      rows += unique.size
    }

    // Items hang off whatever the student is actually cursando, so a deadline is
    // never attached to a materia they have already finished.
    const active = (spec.states ?? [])
      .filter((s) => s.status === 'in_progress' || s.status === 'regularized')
      .map((s) => s.id)

    if (spec.items?.length) {
      await admin.from('academic_items').insert(
        spec.items.map((item) => {
          let dueAt = null
          if (item.offsetDays !== null) {
            const d = new Date()
            d.setDate(d.getDate() + item.offsetDays)
            d.setHours(item.hour ?? 23, 0, 0, 0)
            dueAt = d.toISOString()
          }
          return {
            user_id: userId,
            curriculum_subject_id:
              item.subject === null ? null : (active[item.subject] ?? active[0] ?? null),
            kind: item.kind,
            title: item.title,
            due_at: dueAt,
          }
        }),
      )
      rows += spec.items.length
    }

    if (spec.resources?.length) {
      await admin.from('resources').insert(
        spec.resources.map((resource) => ({
          user_id: userId,
          curriculum_subject_id: active[resource.subject] ?? active[0] ?? null,
          kind: resource.kind,
          title: resource.title,
          url: resource.url ?? null,
          body: resource.body ?? null,
        })),
      )
      rows += spec.resources.length
    }

    return { email, userId, rows }
  } catch (cause) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw cause
  }
}

function printTable(results) {
  const width = Math.max(...SCENARIOS.map((s) => emailFor(s.key).length))
  console.log('')
  console.log(`  contraseña para todas: ${TESTER_PASSWORD}`)
  console.log('')
  for (const scenario of SCENARIOS) {
    const result = results?.get(scenario.key)
    const mark = result ? '✔' : ' '
    console.log(
      `  ${mark} ${emailFor(scenario.key).padEnd(width)}  ${scenario.title}` +
        (result ? `  (${result.rows} filas)` : ''),
    )
    console.log(`    ${' '.repeat(width)}  ↳ ${scenario.covers}`)
  }
  console.log('')
}

async function main() {
  const command = process.argv[2] ?? 'seed'
  const status = localStatus()
  const admin = await adminClient(status)

  if (command === 'list') {
    printTable(null)
    return
  }

  if (command === 'purge') {
    let removed = 0
    for (const scenario of SCENARIOS) {
      const user = await findUser(admin, emailFor(scenario.key))
      if (user) {
        await admin.auth.admin.deleteUser(user.id)
        removed += 1
      }
    }
    console.log(`[tester] removed ${removed} tester account(s). Their data cascaded.`)
    return
  }

  if (command !== 'seed') {
    console.error(`[tester] unknown command "${command}". Use seed | list | purge.`)
    process.exit(1)
  }

  const curricula = {
    utn: await loadCurriculum(admin, PLAN_VERSION.utn),
    unr: await loadCurriculum(admin, PLAN_VERSION.unr),
  }

  const results = new Map()
  for (const scenario of SCENARIOS) {
    const result = await seedScenario(admin, scenario, curricula)
    results.set(scenario.key, result)
  }

  // The dev route reads this so it never has to hardcode the list twice.
  writeFileSync(
    'src/features/dev/scenarios.generated.json',
    JSON.stringify(
      {
        note: 'GENERATED by scripts/tester.mjs — tester tooling, safe to delete.',
        password: TESTER_PASSWORD,
        scenarios: SCENARIOS.map((s) => ({
          key: s.key,
          title: s.title,
          covers: s.covers,
          email: emailFor(s.key),
        })),
      },
      null,
      2,
    ) + '\n',
  )

  printTable(results)
  console.log('  Entrá con cualquiera de esos, o abrí http://localhost:5173/dev')
  console.log('  (necesita VITE_CAMPUS_TESTER=1 en .env)')
  console.log('')
}

// Only act as a CLI when invoked directly. verify-frontend.mjs imports SCENARIOS
// and emailFor from here; without this guard every sweep would silently re-seed.
const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('tester.mjs')

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`[tester] ${error.message}`)
    process.exit(1)
  })
}
