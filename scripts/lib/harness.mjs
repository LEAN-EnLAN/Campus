/**
 * Shared plumbing for `verify:ui` and `verify:a11y`.
 *
 * Both scripts need the same three things: a running preview server, a real
 * signed-up student with real persisted data, and a candidate identity to bind
 * the evidence to. None of that is faked.
 */
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const PREVIEW_URL = 'http://127.0.0.1:4173'

export const ROUTES = [
  { path: '/today', name: 'today', label: 'Hoy' },
  { path: '/plan', name: 'plan', label: 'Plan' },
  { path: '/courses', name: 'courses', label: 'Materias' },
  { path: '/calendar', name: 'calendar', label: 'Calendario' },
  { path: '/library', name: 'library', label: 'Material' },
  { path: '/settings', name: 'settings', label: 'Ajustes' },
]

export const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800, kind: 'mobile' },
  { name: '390x844', width: 390, height: 844, kind: 'mobile' },
  { name: '768x1024', width: 768, height: 1024, kind: 'tablet' },
  { name: '1280x800', width: 1280, height: 800, kind: 'desktop' },
  { name: '1440x900', width: 1440, height: 900, kind: 'desktop' },
]

/**
 * Content-addressed identity of what is being verified.
 *
 * Hashes every source, migration and config file that can change behaviour, so
 * evidence captured against one candidate can never be presented as evidence for
 * a different one.
 */
export function computeCandidateId(root = process.cwd()) {
  const files = []

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|css|sql|mjs|json|html)$/.test(entry.name)) files.push(full)
    }
  }

  for (const dir of ['src', 'supabase/migrations', 'scripts']) {
    try {
      if (statSync(join(root, dir)).isDirectory()) walk(join(root, dir))
    } catch {
      /* directory absent — nothing to hash */
    }
  }
  for (const file of ['index.html', 'package.json', 'vite.config.ts']) {
    try {
      statSync(join(root, file))
      files.push(join(root, file))
    } catch {
      /* optional */
    }
  }

  const hash = createHash('sha256')
  for (const file of files.sort()) {
    hash.update(relative(root, file))
    hash.update(readFileSync(file))
  }
  return `cand_${hash.digest('hex').slice(0, 12)}`
}

export function supabaseStatus() {
  const raw = execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(raw)
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' })
      if (response.ok) return true
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

/** Start `vite preview` against the built app and resolve once it answers. */
export async function startPreview() {
  // `--host 127.0.0.1` is not optional: without it vite binds to `localhost`,
  // which can resolve to ::1 first and leave the IPv4 probe refusing.
  const child = spawn(
    './node_modules/.bin/vite',
    ['preview', '--port', '4173', '--strictPort', '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'], detached: false },
  )

  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))

  const ready = await waitForServer(PREVIEW_URL)
  if (!ready) {
    child.kill('SIGTERM')
    throw new Error(
      `Preview server did not come up at ${PREVIEW_URL}. Did \`pnpm build\` run first?\n${output}`,
    )
  }

  return {
    stop: () => {
      try {
        child.kill('SIGTERM')
      } catch {
        /* already gone */
      }
    },
  }
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
  return path
}

/**
 * Sign up a fresh student and give them real persisted data:
 * an academic context on the UTN plan, one subject passed, one in progress, and
 * a deadline due today.
 *
 * Returns the credentials so the browser can log in through the real UI.
 */
export async function seedStudent(status, label) {
  const { createClient } = await import('@supabase/supabase-js')

  const email = `verify-${label}-${process.pid}-${Date.now()}@campus.test`
  const password = 'campus-verify-123456'

  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'Camila' },
  })
  if (createError) throw new Error(`could not create verify user: ${createError.message}`)
  const userId = created.user.id

  // Everything after the user exists must undo the user if it fails: the caller has
  // no handle to clean up with until this function returns.
  try {
    // The UTN plan is the one with real correlativas, so it exercises availability.
    const { data: curriculum, error: curriculumError } = await admin
      .from('curricula')
      .select('id, curriculum_subjects (id, year_level, display_order)')
      .eq('version', 'Plan 2023')
      .single()
    if (curriculumError) throw new Error(`no seeded curriculum: ${curriculumError.message}`)

    const subjects = [...curriculum.curriculum_subjects].sort(
      (a, b) => a.year_level - b.year_level || a.display_order - b.display_order,
    )
    const passed = subjects[0]
    const inProgress = subjects[1]

    await admin.from('user_academic_contexts').insert({
      user_id: userId,
      curriculum_id: curriculum.id,
      is_active: true,
    })

    await admin.from('user_subject_states').insert([
      { user_id: userId, curriculum_subject_id: passed.id, status: 'passed' },
      { user_id: userId, curriculum_subject_id: inProgress.id, status: 'in_progress' },
    ])

    const today = new Date()
    today.setHours(18, 0, 0, 0)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 4)
    nextWeek.setHours(9, 0, 0, 0)

    await admin.from('academic_items').insert([
      {
        user_id: userId,
        curriculum_subject_id: inProgress.id,
        kind: 'assignment',
        title: 'TP 4 · entrega',
        due_at: today.toISOString(),
      },
      {
        user_id: userId,
        curriculum_subject_id: inProgress.id,
        kind: 'midterm',
        title: 'Primer parcial',
        due_at: nextWeek.toISOString(),
      },
    ])

    await admin.from('resources').insert({
      user_id: userId,
      curriculum_subject_id: inProgress.id,
      kind: 'link',
      title: 'Apuntes de la cátedra',
      url: 'https://example.org/apuntes',
    })
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw error
  }

  return { email, password, userId, cleanup: () => admin.auth.admin.deleteUser(userId) }
}

/** Log in through the real login form — no session injection. */
export async function loginThroughUi(page, { email, password }) {
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Entrá' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/\/today/, { timeout: 20_000 })
}
