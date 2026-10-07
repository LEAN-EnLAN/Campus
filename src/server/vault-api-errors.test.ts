import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

/**
 * Failures are CODES on the wire. The server says what went wrong; it does not
 * write prose for a student, and it never lets an absolute host path out.
 */

let base: string
let root: string
let sessions: VaultSessions
let vaultId: string

const TOKEN = mintToken()
const ORIGIN = 'http://localhost:5173'
const OPTIONS = { allowedOrigins: [ORIGIN], token: TOKEN }

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  handleVaultRequest(
    {
      method: 'POST',
      url,
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'x-campus-capability': TOKEN,
        ...headers,
      },
      body: JSON.stringify(body),
    },
    sessions,
    OPTIONS,
  )

const op = (payload: Record<string, unknown>) => post(`${PREFIX}/${vaultId}/op`, payload)
const parse = (body: string) => JSON.parse(body) as Record<string, unknown>

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'campus-api-err-'))
  root = join(base, 'Campus')
  mkdirSync(join(root, 'Materias'), { recursive: true })
  sessions = new VaultSessions()
  vaultId = (await sessions.open(root)).id
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('operation failures carry a stable code', () => {
  it('a security refusal is outside_vault', async () => {
    symlinkSync(base, join(root, 'esc'))
    const body = parse((await op({ op: 'listDir', path: 'esc' })).body)
    expect(body.ok).toBe(false)
    expect(body.code).toBe('outside_vault')
  })

  it('a missing note is not_found and notFound', async () => {
    const body = parse((await op({ op: 'readNote', path: 'nada.md' })).body)
    expect(body.code).toBe('not_found')
    expect(body.notFound).toBe(true)
  })

  it('a name the vault refuses keeps its path-validation code', async () => {
    const body = parse(
      (await op({ op: 'writeNote', path: 'CON.md', contents: 'x', expectedMtimeMs: null }))
        .body,
    )
    expect(body.code).toBe('name_reserved')
  })

  it('creating over an existing note is an already_exists conflict', async () => {
    await op({ op: 'writeNote', path: 'a.md', contents: 'x', expectedMtimeMs: null })
    const body = parse(
      (await op({ op: 'writeNote', path: 'a.md', contents: 'y', expectedMtimeMs: null })).body,
    )
    expect(body.code).toBe('already_exists')
    expect(body.conflict).toBe(true)
  })

  it('renaming a missing file is not_found, and never leaks the host path', async () => {
    const res = await op({ op: 'rename', path: 'nope.md', to: 'otro.md' })
    const body = parse(res.body)
    expect(body.code).toBe('not_found')
    expect(res.body).not.toContain(base)
    expect(res.body).not.toMatch(/ENOENT|\/tmp/)
  })

  it('an unexpected filesystem error is a generic code with no host path in it', async () => {
    writeFileSync(join(root, 'plain.md'), 'x')
    // A note "below" a file: the OS answers ENOTDIR with the absolute path.
    const res = await op({
      op: 'writeNote',
      path: 'plain.md/inner.md',
      contents: 'x',
      expectedMtimeMs: null,
    })
    const body = parse(res.body)
    expect(body.ok).toBe(false)
    expect(['io_error', 'not_found']).toContain(body.code)
    expect(res.body).not.toContain(base)
    expect(res.body).not.toMatch(/ENOTDIR|ENOENT|\/tmp/)
  })

  it('a conflict message names the path once, not twice', async () => {
    await op({ op: 'writeNote', path: 'dup.md', contents: 'x', expectedMtimeMs: null })
    const res = await op({
      op: 'writeNote',
      path: 'dup.md',
      contents: 'y',
      expectedMtimeMs: null,
    })
    const message = String(parse(res.body).error)
    expect(message.split('dup.md').length - 1).toBe(0)
  })
})

describe('refusals before the operation carry a code too', () => {
  it('no capability is unauthorized', async () => {
    const res = await post(
      `${PREFIX}/${vaultId}/op`,
      { op: 'stat', path: 'a' },
      {
        'x-campus-capability': 'wrong',
      },
    )
    expect(res.status).toBe(401)
    expect(parse(res.body).code).toBe('unauthorized')
  })

  it('a foreign origin is origin_not_allowed', async () => {
    const res = await post(
      `${PREFIX}/${vaultId}/op`,
      { op: 'stat', path: 'a' },
      {
        origin: 'http://evil.example',
      },
    )
    expect(res.status).toBe(403)
    expect(parse(res.body).code).toBe('origin_not_allowed')
  })

  it('an unknown vault id is unknown_vault (the server restarted)', async () => {
    const res = await post(`${PREFIX}/doesnotexist/op`, { op: 'stat', path: 'a' })
    expect(res.status).toBe(404)
    expect(parse(res.body).code).toBe('unknown_vault')
  })

  it('malformed input is bad_request', async () => {
    const res = await op({ op: 'frobnicate', path: 'a' })
    expect(res.status).toBe(400)
    expect(parse(res.body).code).toBe('bad_request')
  })
})
