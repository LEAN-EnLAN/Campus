#!/usr/bin/env node
/**
 * Contract test: the SAME requests against the Node Vault API and the Rust one,
 * responses diffed.
 *
 *   node desktop/scripts/contract.mjs [--rust <campus-serve.exe>] [--report <file.json>]
 *
 * Node side: `src/server/vault-api.ts` loaded through Vite's SSR loader (the
 * real handler, not a copy), mounted on a plain `http` server exactly like the
 * Vite plugin mounts it. Rust side: `campus-serve`. Each server gets its own,
 * byte-identical fixture tree; host paths, opaque ids, trash suffixes and
 * mtimes are normalised before comparing, everything else must be equal:
 * status, the contract headers and the JSON body.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const TOKEN = 'contract-capability-0123456789abcdef'
const NODE_PORT = 47811
const RUST_PORT = 47812

const argv = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : fallback
}
const RUST_BIN = resolve(
  opt('--rust', join(REPO, 'desktop', 'target', 'debug', 'campus-serve.exe')),
)
const REPORT = opt('--report', null)

// ------------------------------------------------------------------ fixtures

function fixture(label) {
  const base = mkdtempSync(join(tmpdir(), `campus-contract-${label}-`))
  const home = join(base, 'home')
  const vault = join(home, 'Campus')
  const outside = join(base, 'outside')
  for (const d of [
    vault,
    outside,
    join(home, '.ssh'),
    join(home, 'zeta'),
    join(home, 'Álgebra'),
    join(home, 'beta'),
    join(vault, 'Materias', 'Análisis I'),
    join(vault, '.campus', 'academic'),
  ])
    mkdirSync(d, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), 'secreto')
  writeFileSync(join(home, 'notes.txt'), 'x')
  writeFileSync(join(vault, 'b.md'), 'bee')
  writeFileSync(join(vault, 'Nota.md'), '# Nota\n')
  writeFileSync(join(vault, 'ñandú.md'), 'ñ')
  writeFileSync(join(vault, 'Materias', 'Análisis I', 'clase 1.md'), 'límites')
  writeFileSync(
    join(vault, '.campus', 'academic', 'items.json'),
    JSON.stringify({ schemaVersion: 1, items: [] }, null, 2) + '\n',
  )
  // Junctions need no privilege on Windows and are links to both runtimes.
  symlinkSync(outside, join(vault, 'escape'), 'junction')
  symlinkSync(outside, join(home, 'out-link'), 'junction')
  symlinkSync(join(home, 'beta'), join(home, 'in-link'), 'junction')
  return { base, home, vault, outside }
}

// ------------------------------------------------------------------- servers

async function startNode(home) {
  const { createServer: createVite } = await import('vite')
  const vite = await createVite({
    root: REPO,
    configFile: false,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, entries: [] },
  })
  const api = await vite.ssrLoadModule('/src/server/vault-api.ts')
  const origins = await vite.ssrLoadModule('/src/server/vault-origins.ts')
  const sessions = new api.VaultSessions({ allowedRoots: [home] })
  const options = {
    allowedOrigins: origins.vaultAllowedOrigins('http', NODE_PORT, undefined),
    token: TOKEN,
  }
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      void api
        .handleVaultRequest(
          {
            method: req.method ?? 'GET',
            url: req.url ?? '',
            headers: req.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          },
          sessions,
          options,
        )
        .then((r) => {
          res.statusCode = r.status
          for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v)
          res.end(r.body)
        })
        .catch((e) => {
          res.statusCode = 599
          res.end(String(e))
        })
    })
  })
  await new Promise((ok) => server.listen(NODE_PORT, '127.0.0.1', ok))
  return { close: async () => (server.close(), await vite.close()) }
}

async function startRust(home) {
  const child = spawn(RUST_BIN, ['--port', String(RUST_PORT), '--dist', join(REPO, 'dist')], {
    env: { ...process.env, CAMPUS_VAULT_TOKEN: TOKEN, CAMPUS_VAULT_ALLOWED_ROOTS: home },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((ok, fail) => {
    child.on('error', fail)
    child.on('exit', (code) => fail(new Error(`campus-serve exited early (${code})`)))
    child.stdout.on('data', (d) => d.toString().includes('URL') && ok())
  })
  return { close: async () => child.kill() }
}

// -------------------------------------------------------------------- script

/**
 * Each step: [label, method, url, headers, body]. `body` may be a function of
 * the per-server context (fixture paths and values captured so far).
 */
const H = { 'x-campus-capability': TOKEN, 'content-type': 'application/json' }
const op = (body) => ['POST', (c) => `/__campus/vault/${c.id}/op`, H, body]
const STEPS = [
  ['preflight', 'OPTIONS', '/__campus/vault/open', { origin: 'ORIGIN' }, null],
  ['foreign origin', 'POST', '/__campus/vault/open', { ...H, origin: 'https://evil.example' }, {}],
  ['listed origin echoes', 'POST', '/__campus/vault/exists', { ...H, origin: 'ORIGIN' }, { path: 'x' }],
  ['no capability', 'POST', '/__campus/vault/open', { origin: 'ORIGIN' }, { path: 'x' }],
  ['wrong capability', 'POST', '/__campus/vault/open', { 'x-campus-capability': 'nope' }, {}],
  ['GET refused', 'GET', '/__campus/vault/open', H, null],
  ['invalid JSON', 'POST', '/__campus/vault/open', H, '{nope'],
  ['unknown endpoint', 'POST', '/__campus/vault/realpath', H, {}],
  ['open: path required', 'POST', '/__campus/vault/open', H, {}],
  ['open: relative', 'POST', '/__campus/vault/open', H, { path: 'Campus' }],
  ['open: outside', 'POST', '/__campus/vault/open', H, (c) => ({ path: c.outside })],
  ['open: outside missing', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.outside, 'nope') })],
  ['open: dot-dot out', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, '..', 'outside') })],
  ['open: missing', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'nope') })],
  ['open: file', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'notes.txt') })],
  ['open: link out', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'out-link') })],
  ['open: create bad type', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'N'), create: 'yes' })],
  ['open: create two levels', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'a', 'b'), create: true })],
  ['open: create one level', 'POST', '/__campus/vault/open', H, (c) => ({ path: join(c.home, 'Nuevo'), create: true })],
  ['exists: vault', 'POST', '/__campus/vault/exists', H, (c) => ({ path: c.vault })],
  ['exists: missing', 'POST', '/__campus/vault/exists', H, (c) => ({ path: join(c.home, 'nope') })],
  ['exists: outside', 'POST', '/__campus/vault/exists', H, (c) => ({ path: c.outside })],
  ['exists: non-string', 'POST', '/__campus/vault/exists', H, { path: 3 }],
  ['dirs: default root', 'POST', '/__campus/vault/dirs', H, {}],
  ['dirs: child', 'POST', '/__campus/vault/dirs', H, (c) => ({ path: join(c.home, 'beta') })],
  ['dirs: outside', 'POST', '/__campus/vault/dirs', H, (c) => ({ path: c.outside })],
  ['dirs: non-string', 'POST', '/__campus/vault/dirs', H, { path: 3 }],
  ['open vault', 'POST', '/__campus/vault/open', H, (c) => ({ path: c.vault }), 'id'],
  ['unknown vault id', 'POST', '/__campus/vault/abc/op', H, { op: 'readNote', path: 'b.md' }],
  ['unsupported op', ...op({ op: 'realpath', path: 'b.md' })],
  ['path not string', ...op({ op: 'readNote', path: 5 })],
  ['listDir root', ...op({ op: 'listDir', path: '' })],
  ['listDir sub', ...op({ op: 'listDir', path: 'Materias' })],
  ['listDir .campus', ...op({ op: 'listDir', path: '.campus' })],
  ['listDir missing', ...op({ op: 'listDir', path: 'nope' })],
  ['listDir file', ...op({ op: 'listDir', path: 'b.md' })],
  ['readNote', ...op({ op: 'readNote', path: 'Materias/Análisis I/clase 1.md' })],
  ['readNote academic', ...op({ op: 'readNote', path: '.campus/academic/items.json' }), 'mtime'],
  ['readNote missing (fresh vault)', ...op({ op: 'readNote', path: '.campus/academic/context.json' })],
  ['readNote dir', ...op({ op: 'readNote', path: 'Materias' })],
  ['readNote traversal', ...op({ op: 'readNote', path: '../../outside/secret.txt' })],
  ['readNote backslash traversal', ...op({ op: 'readNote', path: '..\\..\\outside\\secret.txt' })],
  ['readNote absolute', ...op({ op: 'readNote', path: 'C:\\Windows\\win.ini' })],
  ['readNote reserved', ...op({ op: 'readNote', path: 'CON.md' })],
  ['readNote forbidden char', ...op({ op: 'readNote', path: 'a?b.md' })],
  ['readNote trailing dot', ...op({ op: 'readNote', path: 'nota.' })],
  ['readNote control char', ...op({ op: 'readNote', path: 'a\u0001b' })],
  ['readNote too long', ...op({ op: 'readNote', path: 'a'.repeat(201) })],
  ['readNote empty', ...op({ op: 'readNote', path: '' })],
  ['readNote through junction', ...op({ op: 'readNote', path: 'escape/secret.txt' })],
  ['writeNote: contents type', ...op({ op: 'writeNote', path: 'n.md', contents: 1, expectedMtimeMs: null })],
  ['writeNote: mtime missing', ...op({ op: 'writeNote', path: 'n.md', contents: 'x' })],
  ['writeNote: mtime string', ...op({ op: 'writeNote', path: 'n.md', contents: 'x', expectedMtimeMs: '1' })],
  ['writeNote: new', ...op({ op: 'writeNote', path: 'Nueva/nota.md', contents: '# Nueva', expectedMtimeMs: null })],
  ['writeNote: already exists', ...op({ op: 'writeNote', path: 'b.md', contents: 'x', expectedMtimeMs: null })],
  ['writeNote: stale', ...op({ op: 'writeNote', path: 'b.md', contents: 'x', expectedMtimeMs: 1 })],
  ['writeNote: missing', ...op({ op: 'writeNote', path: 'gone.md', contents: 'x', expectedMtimeMs: 1 })],
  ['writeNote: with loaded mtime', ...op((c) => ({ op: 'writeNote', path: '.campus/academic/items.json', contents: '{"schemaVersion":1,"items":[]}\n', expectedMtimeMs: c.mtime }))],
  ['writeNote: through junction', ...op({ op: 'writeNote', path: 'escape/x.md', contents: 'x', expectedMtimeMs: null })],
  ['readNote: written', ...op({ op: 'readNote', path: 'Nueva/nota.md' })],
  ['mkdir', ...op({ op: 'mkdir', path: 'Carpeta/Sub' })],
  ['mkdir through junction', ...op({ op: 'mkdir', path: 'escape/sub' })],
  ['stat file', ...op({ op: 'stat', path: 'b.md' })],
  ['stat dir', ...op({ op: 'stat', path: 'Materias' })],
  ['stat missing', ...op({ op: 'stat', path: 'nope.md' })],
  ['rename: to missing', ...op({ op: 'rename', path: 'b.md' })],
  ['rename: onto existing', ...op({ op: 'rename', path: 'b.md', to: 'Nota.md' })],
  ['rename: missing source', ...op({ op: 'rename', path: 'nope.md', to: 'x.md' })],
  ['rename: out via junction', ...op({ op: 'rename', path: 'b.md', to: 'escape/b.md' })],
  ['rename: ok', ...op({ op: 'rename', path: 'b.md', to: 'Carpeta/b2.md' })],
  ['trash: ok', ...op({ op: 'trash', path: 'Carpeta/b2.md' })],
  ['trash: missing', ...op({ op: 'trash', path: 'Carpeta/b2.md' })],
  ['trash: through junction', ...op({ op: 'trash', path: 'escape/secret.txt' })],
  ['listDir after', ...op({ op: 'listDir', path: '' })],
  ['listDir trash', ...op({ op: 'listDir', path: '.campus/trash' })],
]

async function run(port, ctx) {
  const origin = `http://127.0.0.1:${port}`
  const results = []
  for (const [label, method, urlOf, headersRaw, bodyRaw, capture] of STEPS) {
    const url = typeof urlOf === 'function' ? urlOf(ctx) : urlOf
    const headers = Object.fromEntries(
      Object.entries(headersRaw).map(([k, v]) => [k, v === 'ORIGIN' ? origin : v]),
    )
    const body0 = typeof bodyRaw === 'function' ? bodyRaw(ctx) : bodyRaw
    const body = body0 === null ? undefined : typeof body0 === 'string' ? body0 : JSON.stringify(body0)
    const res = await fetch(`http://127.0.0.1:${port}${url}`, { method, headers, body })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { __raw: text }
    }
    if (capture === 'id') ctx.id = json?.id
    if (capture === 'mtime') ctx.mtime = json?.value?.mtimeMs
    results.push({
      label,
      status: res.status,
      headers: Object.fromEntries(
        ['content-type', 'access-control-allow-origin', 'access-control-allow-methods',
          'access-control-allow-headers', 'access-control-max-age', 'cache-control', 'vary']
          .map((h) => [h, res.headers.get(h)?.replace(String(port), '<PORT>') ?? null]),
      ),
      json,
    })
  }
  return results
}

function normalise(value, ctx) {
  const roots = [ctx.base, ctx.base.replaceAll('\\', '/')]
  const walk = (v, key) => {
    if (typeof v === 'string') {
      let s = v
      for (const r of roots) s = s.split(r).join('<BASE>')
      if (key === 'id') return '<ID>'
      if (key === 'trashedTo') return s.replace(/^\.campus\/trash\/[0-9a-z]+-[0-9a-z]{4}-/, '.campus/trash/<STAMP>-')
      if (key === 'name' && /^[0-9a-z]+-[0-9a-z]{4}-/.test(s)) return s.replace(/^[0-9a-z]+-[0-9a-z]{4}-/, '<STAMP>-')
      return s
    }
    if (typeof v === 'number' && key === 'mtimeMs') return '<MTIME>'
    if (Array.isArray(v)) return v.map((x) => walk(x, key))
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]))
    return v
  }
  return walk(value, null)
}

// ---------------------------------------------------------------------- main

const nodeFx = fixture('node')
const rustFx = fixture('rust')
let nodeSrv, rustSrv
try {
  nodeSrv = await startNode(nodeFx.home)
  rustSrv = await startRust(rustFx.home)
  const nodeRes = await run(NODE_PORT, { ...nodeFx })
  const rustRes = await run(RUST_PORT, { ...rustFx })

  let failed = 0
  const report = []
  for (let i = 0; i < STEPS.length; i += 1) {
    const a = normalise(nodeRes[i], nodeFx)
    const b = normalise(rustRes[i], rustFx)
    const same = JSON.stringify(a) === JSON.stringify(b)
    if (!same) failed += 1
    report.push({ label: a.label, same, node: a, rust: b })
    console.log(`${same ? 'PASS' : 'FAIL'}  ${String(a.status).padEnd(3)} ${a.label}`)
    if (!same) {
      console.log('  node:', JSON.stringify(a))
      console.log('  rust:', JSON.stringify(b))
    }
  }
  if (REPORT) writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(`\n${STEPS.length - failed}/${STEPS.length} identical`)
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  await nodeSrv?.close()
  await rustSrv?.close()
  for (const f of [nodeFx, rustFx]) rmSync(f.base, { recursive: true, force: true })
}
