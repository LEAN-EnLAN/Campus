import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

const entry = fileURLToPath(new URL('../bin.mjs', import.meta.url))
let root
before(() => {
  root = mkdtempSync(join(tmpdir(), 'campus-cli-e2e-'))
})
after(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})

function cli(...args) {
  const child = spawnSync(process.execPath, [entry, '--root', root, '--json', ...args], {
    encoding: 'utf8',
    timeout: 45_000,
    maxBuffer: 1024 * 1024,
  })
  assert.equal(child.error, undefined, child.error?.message)
  let parsed
  try {
    parsed = JSON.parse(child.stdout)
  } catch {
    throw Error('CLI did not emit JSON: ' + child.stderr + ' / ' + child.stdout)
  }
  return { code: child.status, ...parsed }
}

test('real backend status and empty Vault do not create shadow storage', () => {
  const result = cli('status')
  assert.equal(result.code, 0)
  assert.equal(result.data.mode, 'local')
  assert.equal(result.data.taskCount, 0)
  assert.equal(result.data.resourceCount, 0)
})

test('task CRUD persists through new backend instances', () => {
  const created = cli('tasks', 'create', '--title', 'Práctica QA')
  assert.equal(created.code, 0)
  assert.equal(created.data.title, 'Práctica QA')
  assert.equal(cli('tasks', 'list').data.length, 1)
  assert.equal(cli('tasks', 'done', created.data.id).code, 0)
  assert.equal(cli('tasks', 'list').data[0].status, 'done')
  assert.equal(cli('tasks', 'remove', created.data.id).code, 0)
  assert.deepEqual(cli('tasks', 'list').data, [])
  assert.equal(statSync(join(root, '.campus', 'academic', 'items.json')).isFile(), true)
})

test('resource CRUD uses the same LocalBackend', () => {
  const created = cli(
    'resources',
    'create',
    '--title',
    'Apuntes',
    '--kind',
    'note',
    '--body',
    'Texto',
  )
  assert.equal(created.code, 0)
  assert.equal(cli('resources', 'list').data[0].body, 'Texto')
  assert.equal(cli('resources', 'remove', created.data.id).code, 0)
  assert.deepEqual(cli('resources', 'list').data, [])
})

test('invalid inputs fail with stable code, no partial write', () => {
  assert.equal(cli('tasks', 'create', '--title', '').code, 2)
  const bad = cli('subjects', 'set', 'fake-id', 'available')
  assert.equal(bad.code, 2)
  assert.equal(cli('subjects', 'set', 'fake-id', 'passed').code, 4)
  assert.equal(
    cli('resources', 'create', '--title', 'No', '--kind', 'link', '--url', 'file:///private')
      .code,
    4,
  )
  assert.equal(cli('tasks', 'create', '--title', 'No', '--subject', 'foreign-subject').code, 4)
  assert.equal(cli('tasks', 'list').data.length, 0)
})

test('rejects implicit root and Windows relative path', () => {
  const child = spawnSync(process.execPath, [entry, '--json', 'status'], { encoding: 'utf8' })
  const result = JSON.parse(child.stdout)
  assert.equal(child.status, 3)
  assert.equal(result.ok, false)
})
