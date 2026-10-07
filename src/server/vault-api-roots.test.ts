import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

/**
 * DEV-04. The page names an absolute path to open a Vault, so the server decides
 * WHICH folders may be opened. Default: the user's home. `/etc` and `/` are not
 * Vaults, and `exists` must not become an oracle for the rest of the disk.
 */

let base: string
let home: string
let outside: string
let sessions: VaultSessions

const TOKEN = mintToken()
const ORIGIN = 'http://localhost:5173'

const post = (url: string, body: unknown) =>
  handleVaultRequest(
    {
      method: 'POST',
      url,
      headers: { origin: ORIGIN, 'x-campus-capability': TOKEN },
      body: JSON.stringify(body),
    },
    sessions,
    { allowedOrigins: [ORIGIN], token: TOKEN },
  )

const open = (path: unknown) => post(`${PREFIX}/open`, { path })
const exists = (path: unknown) => post(`${PREFIX}/exists`, { path })
const parse = (body: string) => JSON.parse(body) as Record<string, unknown>

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'campus-roots-')))
  home = join(base, 'home')
  outside = join(base, 'elsewhere')
  mkdirSync(join(home, 'Campus'), { recursive: true })
  mkdirSync(join(outside, 'secret'), { recursive: true })
  writeFileSync(join(home, 'archivo.txt'), 'x')
  sessions = new VaultSessions({ allowedRoots: [home] })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('open', () => {
  it('opens a folder under an allowed root', async () => {
    const res = await open(join(home, 'Campus'))
    expect(res.status).toBe(200)
    expect(parse(res.body).name).toBe('Campus')
  })

  it('opens the allowed root itself', async () => {
    expect((await open(home)).status).toBe(200)
  })

  it('refuses a folder outside every allowed root, with a code', async () => {
    for (const path of [outside, join(outside, 'secret'), '/etc', '/']) {
      const res = await open(path)
      expect(res.status, path).toBeGreaterThanOrEqual(400)
      expect(parse(res.body).code, path).toBe('folder_outside_roots')
    }
  })

  it('does not tell a missing folder from an existing one outside the roots', async () => {
    const real = parse((await open(join(outside, 'secret'))).body)
    const missing = parse((await open(join(outside, 'nope'))).body)
    expect(real.code).toBe('folder_outside_roots')
    expect(missing.code).toBe('folder_outside_roots')
    expect(missing.error).toBe(real.error)
  })

  it('refuses dot-dot that climbs out of an allowed root', async () => {
    const res = await open(join(home, '..', 'elsewhere', 'secret'))
    expect(parse(res.body).code).toBe('folder_outside_roots')
  })

  it('refuses a symlink inside the home that points outside it', async () => {
    symlinkSync(join(outside, 'secret'), join(home, 'trampolin'))
    const res = await open(join(home, 'trampolin'))
    expect(parse(res.body).code).toBe('folder_outside_roots')
  })

  it('allows a symlink inside the home that stays inside it', async () => {
    symlinkSync(join(home, 'Campus'), join(home, 'atajo'))
    expect((await open(join(home, 'atajo'))).status).toBe(200)
  })

  it('tells missing, not-a-folder and relative apart inside the roots', async () => {
    expect(parse((await open(join(home, 'nada'))).body).code).toBe('folder_not_found')
    expect(parse((await open(join(home, 'archivo.txt'))).body).code).toBe(
      'folder_not_directory',
    )
    expect(parse((await open('Campus')).body).code).toBe('folder_not_absolute')
  })

  it('reports no permission as its own code', async () => {
    // A path whose parent cannot be traversed. Skipped where the OS lets us through (root).
    if (process.getuid?.() === 0) return
    const locked = join(home, 'locked')
    mkdirSync(join(locked, 'inner'), { recursive: true })
    const { chmodSync } = await import('node:fs')
    chmodSync(locked, 0o000)
    try {
      const res = await open(join(locked, 'inner'))
      expect(parse(res.body).code).toBe('permission_denied')
    } finally {
      chmodSync(locked, 0o755)
    }
  })

  it('a vault opened under the roots then works as before', async () => {
    const id = parse((await open(join(home, 'Campus'))).body).id as string
    const res = await post(`${PREFIX}/${id}/op`, {
      op: 'writeNote',
      path: 'n.md',
      contents: 'x',
      expectedMtimeMs: null,
    })
    expect(res.status).toBe(200)
  })
})

describe('exists', () => {
  it('is true for a folder under the roots', async () => {
    expect(parse((await exists(join(home, 'Campus'))).body).exists).toBe(true)
  })

  it('is false for a missing folder under the roots', async () => {
    expect(parse((await exists(join(home, 'nada'))).body).exists).toBe(false)
  })

  it('never reveals anything outside the roots: existing and missing look identical', async () => {
    const answers = await Promise.all(
      [outside, join(outside, 'secret'), join(outside, 'nope'), '/etc', '/root', '/'].map(
        async (p) => (await exists(p)).body,
      ),
    )
    expect(new Set(answers).size).toBe(1)
    expect(parse(answers[0]!).exists).toBe(false)
  })

  it('does not follow a link out of the roots', async () => {
    symlinkSync(join(outside, 'secret'), join(home, 'trampolin'))
    expect(parse((await exists(join(home, 'trampolin'))).body).exists).toBe(false)
  })
})

describe('the default', () => {
  it('is the user home directory', () => {
    expect(new VaultSessions().allowedRoots).toEqual([homedir()])
  })
})
