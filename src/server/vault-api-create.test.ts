import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

/**
 * `open` with `create: true` — the first-run "use the suggested folder" button.
 * It makes ONE folder, directly inside a folder that already exists under an
 * allowed root. It is never a recursive mkdir and never reaches outside the
 * roots: the same confinement as plain `open`, applied to the parent.
 */

let base: string
let home: string
let outside: string
let sessions: VaultSessions

const TOKEN = mintToken()
const ORIGIN = 'http://localhost:5173'

const open = (path: unknown, create?: unknown) =>
  handleVaultRequest(
    {
      method: 'POST',
      url: `${PREFIX}/open`,
      headers: { origin: ORIGIN, 'x-campus-capability': TOKEN },
      body: JSON.stringify({ path, create }),
    },
    sessions,
    { allowedOrigins: [ORIGIN], token: TOKEN },
  )
const parse = (body: string) => JSON.parse(body) as Record<string, unknown>

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'campus-create-')))
  home = join(base, 'home')
  outside = join(base, 'elsewhere')
  mkdirSync(join(home, 'Documents'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  sessions = new VaultSessions({ allowedRoots: [home] })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('open with create', () => {
  it('without create, a missing folder is still just missing', async () => {
    const res = await open(join(home, 'Documents', 'Campus'))
    expect(res.status).toBe(404)
    expect(existsSync(join(home, 'Documents', 'Campus'))).toBe(false)
  })

  it('creates the folder and opens it', async () => {
    const res = await open(join(home, 'Documents', 'Campus'), true)
    expect(res.status).toBe(200)
    expect(parse(res.body).name).toBe('Campus')
    expect(existsSync(join(home, 'Documents', 'Campus'))).toBe(true)
  })

  it('opens a folder that already exists without touching it', async () => {
    const res = await open(join(home, 'Documents'), true)
    expect(res.status).toBe(200)
    expect(parse(res.body).name).toBe('Documents')
  })

  it('makes one level only: a missing parent is not created', async () => {
    const res = await open(join(home, 'Nada', 'Campus'), true)
    expect(res.status).toBe(404)
    expect(existsSync(join(home, 'Nada'))).toBe(false)
  })

  it('refuses to create outside the allowed roots', async () => {
    const res = await open(join(outside, 'Campus'), true)
    expect(res.status).toBe(403)
    expect(parse(res.body).code).toBe('folder_outside_roots')
    expect(existsSync(join(outside, 'Campus'))).toBe(false)
  })

  it('refuses a `..` that climbs out of the roots', async () => {
    const res = await open(join(home, '..', 'elsewhere', 'Campus'), true)
    expect(res.status).toBe(403)
    expect(existsSync(join(outside, 'Campus'))).toBe(false)
  })

  it('refuses to create through a symlink that points out of the roots', async () => {
    symlinkSync(outside, join(home, 'salida'))
    const res = await open(join(home, 'salida', 'Campus'), true)
    expect(res.status).toBe(403)
    expect(existsSync(join(outside, 'Campus'))).toBe(false)
  })

  it('needs a real boolean: anything else is a bad request', async () => {
    const res = await open(join(home, 'Documents', 'Campus'), 'yes')
    expect(res.status).toBe(400)
    expect(existsSync(join(home, 'Documents', 'Campus'))).toBe(false)
  })
})
