#!/usr/bin/env node
import { lstat, realpath } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const allowedStatuses = [
  'in_progress',
  'regularized',
  'passed',
  'failed',
  'equivalent',
  'clear',
]
const kinds = ['task', 'assignment', 'midterm', 'final', 'registration', 'class', 'custom']
const usage = `Campus Local CLI — same academic backend and vault as the UI

Usage: node packages/campus-cli/bin.mjs --root ABSOLUTE_FOLDER [--json] COMMAND
  status
  subjects list
  subjects set SUBJECT_ID STATUS [--grade 1-10] [--manual]
  tasks list
  tasks create --title TITLE [--kind task] [--subject ID] [--due ISO] [--notes TEXT]
  tasks done ID [--undo]
  tasks remove ID
  resources list
  resources create --title TITLE --kind link|note [--url https://...] [--body TEXT] [--subject ID]
  resources remove ID
  catalog institutions

Exit 0 success · 2 argument error · 3 invalid Vault root · 4 backend validation · 1 internal error.
No root is inferred from the current working directory. Cloud is not supported by this CLI.
All mutations go through LocalBackend and VaultRepository; never edit .campus files by hand.`

function fail(message, exitCode = 2) {
  const error = new Error(message)
  error.exitCode = exitCode
  throw error
}

function parse(argv) {
  const options = {}
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (['--json', '--manual', '--undo', '--help', '-h'].includes(token)) {
      options[token] = true
    } else if (token.startsWith('--')) {
      const key = token
      const value = argv[++i]
      if (!value || value.startsWith('--')) fail(`Missing value for ${key}`)
      options[key] = value
    } else positionals.push(token)
  }
  return { options, positionals }
}

async function createBackend(root) {
  if (!root || !isAbsolute(root)) fail('--root must be an absolute path', 3)
  const physical = await realpath(root).catch(() => fail('Vault root does not exist', 3))
  const metadata = await lstat(root).catch(() => fail('Vault root is not readable', 3))
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    fail('Vault root must be a real directory, not a symlink or file', 3)
  const vite = await createServer({
    root: repo,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    logLevel: 'silent',
  })
  try {
    const [
      { LocalBackend },
      { VaultRepository },
      { nodeFileSystem },
      { loadPortableCatalog },
      { nodeCatalogReader },
    ] = await Promise.all([
      vite.ssrLoadModule('/src/lib/backends/local/local-backend.ts'),
      vite.ssrLoadModule('/src/lib/vault/vault-repository.ts'),
      vite.ssrLoadModule('/src/lib/vault/node-fs.ts'),
      vite.ssrLoadModule('/src/lib/backends/local/catalog.ts'),
      vite.ssrLoadModule('/src/lib/backends/local/node-catalog.ts'),
    ])
    const catalog = await loadPortableCatalog(
      join(repo, 'public', 'academic-catalog'),
      nodeCatalogReader,
    )
    return {
      backend: new LocalBackend(new VaultRepository(nodeFileSystem, physical), catalog),
      close: () => vite.close(),
    }
  } catch (error) {
    await vite.close()
    throw error
  }
}

function required(options, key) {
  if (!options[key] || !String(options[key]).trim()) fail(`Missing ${key}`)
  return String(options[key]).trim()
}

async function assertSubject(backend, id, manual = false) {
  if (!id) return
  if (manual) {
    const subjects = await backend.academic.manualSubjects()
    if (subjects.some((subject) => subject.id === id)) return
    fail('Unknown manual subject in selected Vault', 4)
  }
  const context = await backend.academic.context()
  if (!context?.curriculumId)
    fail('Select an academic plan before referring to its subjects', 4)
  const bundle = await backend.catalog.curriculumBundle(context.curriculumId)
  if (!bundle.subjects.some((subject) => subject.id === id))
    fail('Subject is not part of the selected curriculum', 4)
}

async function run(backend, positionals, options) {
  const [group, action, id, value] = positionals
  if (group === 'status' && !action) {
    const [context, states, tasks, resources] = await Promise.all([
      backend.academic.context(),
      backend.academic.subjectStates(),
      backend.items.list(),
      backend.resources.list(),
    ])
    return {
      mode: backend.kind,
      context,
      subjectStateCount: states.length,
      taskCount: tasks.length,
      resourceCount: resources.length,
    }
  }
  if (group === 'catalog' && action === 'institutions') return backend.catalog.institutions()
  if (group === 'subjects' && action === 'list') {
    const [context, states, manual] = await Promise.all([
      backend.academic.context(),
      backend.academic.subjectStates(),
      backend.academic.manualSubjects(),
    ])
    const bundle = context?.curriculumId
      ? await backend.catalog.curriculumBundle(context.curriculumId)
      : null
    const byId = new Map(states.map((s) => [s.curriculumSubjectId, s]))
    return {
      context,
      prerequisitesKnown: bundle?.prerequisitesKnown ?? false,
      subjects: (bundle?.subjects ?? []).map((subject) => ({
        id: subject.id,
        name: subject.name,
        yearLevel: subject.yearLevel,
        storedStatus: byId.get(subject.id)?.status ?? null,
        grade: byId.get(subject.id)?.grade ?? null,
      })),
      manual,
    }
  }
  if (group === 'subjects' && action === 'set') {
    if (!id || !allowedStatuses.includes(value))
      fail(`Usage: subjects set ID STATUS (${allowedStatuses.join(', ')})`)
    await assertSubject(backend, id, Boolean(options['--manual']))
    const grade = options['--grade'] === undefined ? null : Number(options['--grade'])
    if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 10))
      fail('Grade must be an integer 1–10')
    await backend.academic.setSubjectStatus({
      curriculumSubjectId: id,
      status: value === 'clear' ? null : value,
      grade,
      manual: Boolean(options['--manual']),
    })
    return { id, status: value === 'clear' ? null : value }
  }
  if (group === 'tasks' && action === 'list') return backend.items.list()
  if (group === 'tasks' && action === 'create') {
    const title = required(options, '--title')
    const kind = options['--kind'] ?? 'task'
    if (!kinds.includes(kind)) fail('Invalid task kind', 4)
    if (options['--due'] && Number.isNaN(Date.parse(options['--due'])))
      fail('Due date must be a valid ISO date or timestamp', 4)
    await assertSubject(backend, options['--subject'])
    return backend.items.create({
      title,
      kind,
      curriculumSubjectId: options['--subject'] ?? null,
      dueAt: options['--due'] ?? null,
      notes: options['--notes'] ?? null,
    })
  }
  if (group === 'tasks' && action === 'done') {
    if (!id) fail('Usage: tasks done ID [--undo]')
    await backend.items.setDone(id, !options['--undo'])
    return { id, done: !options['--undo'] }
  }
  if (group === 'tasks' && action === 'remove') {
    if (!id) fail('Usage: tasks remove ID')
    await backend.items.remove(id)
    return { removed: id }
  }
  if (group === 'resources' && action === 'list') return backend.resources.list()
  if (group === 'resources' && action === 'create') {
    const title = required(options, '--title')
    const kind = required(options, '--kind')
    if (!['link', 'note'].includes(kind)) fail('Resources can be links or notes', 4)
    if (kind === 'link') {
      let link
      try {
        link = new URL(options['--url'] ?? '')
      } catch {
        fail('Link needs a valid URL', 4)
      }
      if (!['http:', 'https:'].includes(link.protocol))
        fail('Only HTTP(S) links are allowed', 4)
    }
    await assertSubject(backend, options['--subject'])
    return backend.resources.create({
      title,
      kind,
      curriculumSubjectId: options['--subject'] ?? null,
      url: options['--url'] ?? null,
      body: options['--body'] ?? null,
    })
  }
  if (group === 'resources' && action === 'remove') {
    if (!id) fail('Usage: resources remove ID')
    await backend.resources.remove(id)
    return { removed: id }
  }
  fail(`Unknown command: ${positionals.join(' ')}`)
}

export async function main(argv = process.argv.slice(2)) {
  let json = argv.includes('--json')
  try {
    const { options, positionals } = parse(argv)
    json = Boolean(options['--json'])
    if (options['--help'] || options['-h'] || !positionals.length) {
      console.log(usage)
      return 0
    }
    const instance = await createBackend(options['--root'])
    try {
      const data = await run(instance.backend, positionals, options)
      console.log(JSON.stringify(json ? { ok: true, data } : data, null, json ? 0 : 2))
      return 0
    } finally {
      await instance.close()
    }
  } catch (error) {
    const code = error.exitCode ?? (error.name === 'BackendError' ? 4 : 1)
    if (json)
      console.log(JSON.stringify({ ok: false, error: { code, message: error.message } }))
    else console.error(`Campus CLI: ${error.message}`)
    return code
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main()
}
