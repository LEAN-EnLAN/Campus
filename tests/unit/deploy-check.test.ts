import { execFile } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)

/** Run the script; resolve with its exit code and combined output. */
async function check(...args: string[]) {
  try {
    const { stdout, stderr } = await run('node', ['scripts/deploy-check.mjs', ...args], {
      cwd: process.cwd(),
    })
    return { code: 0, output: stdout + stderr }
  } catch (error) {
    const e = error as { code: number; stdout: string; stderr: string }
    return { code: e.code, output: e.stdout + e.stderr }
  }
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (role: string) => `${b64url({ alg: 'HS256' })}.${b64url({ role })}.sig`

const dirs: string[] = []
function dist(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'campus-dist-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'assets'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const INDEX = '<html><div id="root"></div><script src="/assets/app-abc.js"></script></html>'

describe('deploy-check — bundle scan', () => {
  it('passes a clean hosted bundle', async () => {
    const dir = dist({
      'index.html': INDEX,
      'assets/app-abc.js': `fetch("https://abc.supabase.co", {k:"${jwt('anon')}"})`,
    })
    const { code, output } = await check('--dist', dir)
    expect(output).toContain('OK')
    expect(code).toBe(0)
  })

  it('fails on the published tester password or tester accounts', async () => {
    const dir = dist({ 'index.html': INDEX, 'assets/app-abc.js': 'p="campus-tester"' })
    const { code, output } = await check('--dist', dir)
    expect(code).toBe(1)
    expect(output).toContain('tester')
  })

  it('fails on a service-role key, even though it is only base64 in the bundle', async () => {
    const dir = dist({ 'index.html': INDEX, 'assets/app-abc.js': `k="${jwt('service_role')}"` })
    const { code, output } = await check('--dist', dir)
    expect(code).toBe(1)
    expect(output).toContain('service_role')
  })

  it('fails on a bundle built against the local Supabase stack', async () => {
    const dir = dist({ 'index.html': INDEX, 'assets/app-abc.js': 'u="http://127.0.0.1:54321"' })
    const { code, output } = await check('--dist', dir)
    expect(code).toBe(1)
    expect(output).toContain('local')
  })

  it('fails when there is no build output', async () => {
    const { code } = await check('--dist', join(tmpdir(), 'campus-no-such-dist'))
    expect(code).toBe(1)
  })
})

describe('deploy-check — live URL', () => {
  let server: Server

  const serve = async (assetCache: string, missingStatus: number) => {
    server = createServer((req, res) => {
      if (req.url === '/assets/app-abc.js') {
        res.writeHead(200, { 'Cache-Control': assetCache, 'Content-Type': 'text/javascript' })
        return res.end('x')
      }
      if (req.url?.startsWith('/assets/')) {
        res.writeHead(missingStatus)
        return res.end('nope')
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(INDEX)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

  it('passes when deep links resolve, missing assets 404 and assets are immutable', async () => {
    const url = await serve('public, max-age=31536000, immutable', 404)
    const { code, output } = await check('--url', url)
    expect(output).toContain('OK')
    expect(code).toBe(0)
  })

  it('fails when a missing asset is answered with the HTML shell', async () => {
    const url = await serve('public, max-age=31536000, immutable', 200)
    const { code, output } = await check('--url', url)
    expect(code).toBe(1)
    expect(output).toContain('missing asset')
  })

  it('fails when assets are not long-cached', async () => {
    const url = await serve('max-age=0', 404)
    const { code, output } = await check('--url', url)
    expect(code).toBe(1)
    expect(output).toContain('Cache-Control')
  })
})
