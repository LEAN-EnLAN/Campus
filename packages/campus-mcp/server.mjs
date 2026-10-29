#!/usr/bin/env node
/**
 * Campus MCP over stdio only. No TCP/HTTP listener, tunnel, stored credentials
 * or implicit workspace. A local desktop agent launches this subprocess with
 * an explicit Vault root; write tools require a separate --allow-write flag.
 */
import { spawnSync } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../campus-cli/bin.mjs', import.meta.url))
const params = process.argv.slice(2)
const rootAt = params.indexOf('--root')
const root = rootAt >= 0 ? params[rootAt + 1] : undefined
const allowWrite = params.includes('--allow-write')
if (!root || !isAbsolute(root)) {
  console.error(
    'Usage: node packages/campus-mcp/server.mjs --root ABSOLUTE_LOCAL_VAULT [--allow-write]',
  )
  process.exit(2)
}

const text = { type: 'string' }
const input = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})
const tools = [
  ['campus_status', 'Estado académico y resumen del Vault Local', input(), ['status']],
  [
    'campus_subjects_list',
    'Materias reales y estados almacenados',
    input(),
    ['subjects', 'list'],
  ],
  ['campus_tasks_list', 'Listar entregas y tareas', input(), ['tasks', 'list']],
  ['campus_resources_list', 'Listar materiales y notas', input(), ['resources', 'list']],
  [
    'campus_task_create',
    'Crear una tarea real',
    input({ title: text, kind: text, due: text, subject: text, notes: text }, ['title']),
    ['tasks', 'create'],
  ],
  [
    'campus_task_done',
    'Marcar o desmarcar una tarea',
    input({ id: text, undo: { type: 'boolean' } }, ['id']),
    ['tasks', 'done'],
  ],
  [
    'campus_task_remove',
    'Eliminar una tarea real',
    input({ id: text }, ['id']),
    ['tasks', 'remove'],
  ],
  [
    'campus_resource_create',
    'Crear enlace o nota',
    input(
      {
        title: text,
        kind: { type: 'string', enum: ['link', 'note'] },
        url: text,
        body: text,
        subject: text,
      },
      ['title', 'kind'],
    ),
    ['resources', 'create'],
  ],
  [
    'campus_resource_remove',
    'Eliminar material o nota',
    input({ id: text }, ['id']),
    ['resources', 'remove'],
  ],
  [
    'campus_subject_set_status',
    'Modificar el estado guardado de una materia',
    input(
      {
        id: text,
        status: {
          type: 'string',
          enum: ['in_progress', 'regularized', 'passed', 'failed', 'equivalent', 'clear'],
        },
        grade: { type: 'integer', minimum: 1, maximum: 10 },
        manual: { type: 'boolean' },
      },
      ['id', 'status'],
    ),
    ['subjects', 'set'],
  ],
]
const byName = new Map(
  tools.map(([name, description, inputSchema, command]) => [
    name,
    { name, description, inputSchema, command },
  ]),
)

function argsFor(tool, args) {
  const command = [...tool.command]
  if (
    [
      'campus_task_done',
      'campus_task_remove',
      'campus_resource_remove',
      'campus_subject_set_status',
    ].includes(tool.name)
  )
    command.push(args.id)
  if (tool.name === 'campus_subject_set_status') command.push(args.status)
  const values = {
    title: '--title',
    kind: '--kind',
    due: '--due',
    subject: '--subject',
    notes: '--notes',
    url: '--url',
    body: '--body',
    grade: '--grade',
  }
  for (const [field, flag] of Object.entries(values)) {
    if (args[field] !== undefined) command.push(flag, String(args[field]))
  }
  if (args.undo) command.push('--undo')
  if (args.manual) command.push('--manual')
  return command
}

function runTool(name, values = {}) {
  const tool = byName.get(name)
  if (!tool) return { isError: true, content: [{ type: 'text', text: 'Unknown Campus tool' }] }
  if (typeof values !== 'object' || values === null || Array.isArray(values))
    return {
      isError: true,
      content: [{ type: 'text', text: 'Tool arguments must be an object' }],
    }
  if (Object.keys(values).some((field) => !Object.hasOwn(tool.inputSchema.properties, field)))
    return { isError: true, content: [{ type: 'text', text: 'Unsupported argument' }] }
  if (
    tool.inputSchema.required.some(
      (field) => typeof values[field] !== 'string' || !values[field].trim(),
    )
  )
    return { isError: true, content: [{ type: 'text', text: 'Required argument missing' }] }
  const writing = !name.endsWith('_list') && name !== 'campus_status'
  if (writing && !allowWrite)
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Read-only MCP server: relaunch with --allow-write to enable mutations',
        },
      ],
    }
  const child = spawnSync(
    process.execPath,
    [cli, '--root', root, '--json', ...argsFor(tool, values)],
    {
      encoding: 'utf8',
      timeout: 60_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 2,
    },
  )
  let result
  try {
    result = JSON.parse(child.stdout.trim())
  } catch {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Campus CLI could not return JSON' }],
    }
  }
  return {
    isError: child.status !== 0 || result.ok === false,
    content: [{ type: 'text', text: JSON.stringify(result.ok ? result.data : result.error) }],
  }
}

function answer(request) {
  const { id, method, params: arguments_ = {} } = request
  if (method === 'notifications/initialized' || method === 'notifications/cancelled')
    return null
  if (id === undefined || id === null) return null
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        serverInfo: { name: 'campus-local-mcp', version: '0.1.0' },
        capabilities: { tools: { listChanged: false } },
      },
    }
  }
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} }
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: tools
          .filter(([name]) => allowWrite || name === 'campus_status' || name.endsWith('_list'))
          .map(([name, description, inputSchema]) => ({ name, description, inputSchema })),
      },
    }
  }
  if (method === 'tools/call') {
    return { jsonrpc: '2.0', id, result: runTool(arguments_.name, arguments_.arguments ?? {}) }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
lines.on('line', (line) => {
  try {
    const request = JSON.parse(line)
    if (!request || request.jsonrpc !== '2.0') return
    const reply = answer(request)
    if (reply) process.stdout.write(JSON.stringify(reply) + '\n')
  } catch {
    // Protocol diagnostics are stderr-only: stdout is reserved for JSON-RPC.
    console.error('Rejected malformed MCP JSON-RPC input')
  }
})
