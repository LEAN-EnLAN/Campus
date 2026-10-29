import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, test } from 'node:test'

const server = fileURLToPath(new URL('../server.mjs', import.meta.url))
const cli = fileURLToPath(new URL('../../campus-cli/bin.mjs', import.meta.url))
let root
before(() => {
  root = mkdtempSync(join(tmpdir(), 'campus-mcp-qa-'))
})
after(() => {
  if (root) rmSync(root, { recursive: true, force: true })
})
function rpc(method, id, params) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params })
}
function exchange(messages, write = false) {
  const child = spawnSync(
    process.execPath,
    [server, '--root', root, ...(write ? ['--allow-write'] : [])],
    {
      input: messages.join('\n') + '\n',
      encoding: 'utf8',
      timeout: 90_000,
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    },
  )
  assert.equal(child.status, 0, child.stderr)
  return child.stdout.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
}
test('MCP initializes and refuses writes without opt-in', () => {
  const responses = exchange([
    rpc('initialize', 1, {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'fixture', version: '1' },
    }),
    rpc('tools/list', 2, {}),
    rpc('tools/call', 3, { name: 'campus_status', arguments: {} }),
    rpc('tools/call', 4, { name: 'campus_task_create', arguments: { title: 'Not allowed' } }),
  ])
  assert.equal(responses.length, 4)
  assert.equal(responses[0].result.protocolVersion, '2025-06-18')
  assert(responses[1].result.tools.some((tool) => tool.name === 'campus_tasks_list'))
  assert.equal(responses[2].result.isError, false)
  assert.equal(JSON.parse(responses[2].result.content[0].text).mode, 'local')
  assert.equal(responses[3].result.isError, true)
})
test('MCP write opt-in creates a task in the real LocalBackend', () => {
  const responses = exchange(
    [
      rpc('tools/call', 10, {
        name: 'campus_task_create',
        arguments: { title: 'Trabajo MCP' },
      }),
      rpc('tools/call', 11, { name: 'campus_tasks_list', arguments: {} }),
    ],
    true,
  )
  assert.equal(responses[0].result.isError, false)
  const task = JSON.parse(responses[0].result.content[0].text)
  assert.equal(task.title, 'Trabajo MCP')
  const listed = JSON.parse(responses[1].result.content[0].text)
  assert(listed.some((entry) => entry.id === task.id))
  const independent = spawnSync(
    process.execPath,
    [cli, '--root', root, '--json', 'tasks', 'list'],
    {
      encoding: 'utf8',
      timeout: 45_000,
    },
  )
  assert.equal(independent.status, 0, independent.stderr)
  assert(JSON.parse(independent.stdout).data.some((entry) => entry.id === task.id))
})
