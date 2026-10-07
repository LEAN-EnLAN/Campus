import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

/**
 * The directory-listing endpoint behind a future in-app folder browser
 * (docs/future-ideas.md). It widens what the API exposes, so the constraints are
 * tests: directories only, names only, the same token + origin guard, confined to
 * the allowed roots, and no way out through a symlink.
 */

let base: string
let home: string
let outside: string
let sessions: VaultSessions

const TOKEN = mintToken()
const ORIGIN = 'http://localhost:5173'

const call = (
  body: unknown,
  over: { method?: string; headers?: Record<string, string | undefined> } = {},
) =>
  handleVaultRequest(
    {
      method: over.method ?? 'POST',
      url: `${PREFIX}/dirs`,
      headers: { origin: ORIGIN, 'x-campus-capability': TOKEN, ...over.headers },
      body: JSON.stringify(body),
    },
    sessions,
    { allowedOrigins: [ORIGIN], token: TOKEN },
  )

const list = async (path?: string) => {
  const res = await call(path === undefined ? {} : { path })
  return {
    status: res.status,
    body: JSON.parse(res.body) as Record<string, unknown>,
    raw: res.body,
  }
}

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'campus-dirs-')))
  home = join(base, 'home')
  outside = join(base, 'elsewhere')
  for (const dir of ['Campus', 'Facultad/Materias', 'Zeta', '.ssh', '.config']) {
    mkdirSync(join(home, dir), { recursive: true })
  }
  mkdirSync(join(outside, 'secret'), { recursive: true })
  writeFileSync(join(home, 'archivo.txt'), 'x')
  writeFileSync(join(home, 'Campus', 'nota.md'), 'x')
  sessions = new VaultSessions({ allowedRoots: [home] })
})

afterEach(() => rmSync(base, { recursive: true, force: true }))

describe('what it returns', () => {
  it('lists directories only, as plain names, sorted', async () => {
    const { status, body } = await list(home)
    expect(status).toBe(200)
    expect(body.dirs).toEqual(['Campus', 'Facultad', 'Zeta'])
  })

  it('never returns file names, contents, sizes or times', async () => {
    const { raw } = await list(join(home, 'Campus'))
    expect(raw).not.toMatch(/nota\.md|archivo\.txt|mtime|size/)
    expect(JSON.parse(raw).dirs).toEqual([])
  })

  it('hides dot-folders, the way a folder picker does', async () => {
    const { raw } = await list(home)
    expect(raw).not.toMatch(/\.ssh|\.config/)
  })

  it('says where it is, and the parent while that is still inside the roots', async () => {
    const inner = await list(join(home, 'Facultad'))
    expect(inner.body.path).toBe(join(home, 'Facultad'))
    expect(inner.body.parent).toBe(home)

    const top = await list(home)
    expect(top.body.path).toBe(home)
    expect(top.body.parent).toBeNull()
  })

  it('with no path, starts at the first allowed root', async () => {
    const { body } = await list()
    expect(body.path).toBe(home)
  })
})

describe('confinement', () => {
  it('refuses anything outside the allowed roots, with a code, whether or not it exists', async () => {
    const answers = []
    for (const path of [outside, join(outside, 'secret'), join(outside, 'nope'), '/etc', '/']) {
      const { status, body } = await list(path)
      expect(status, path).toBe(403)
      expect(body.code, path).toBe('folder_outside_roots')
      answers.push(JSON.stringify(body))
    }
    expect(new Set(answers).size).toBe(1)
  })

  it('refuses dot-dot that climbs out', async () => {
    const { body } = await list(join(home, '..', 'elsewhere'))
    expect(body.code).toBe('folder_outside_roots')
  })

  it('refuses to list through a symlink that leaves the roots', async () => {
    symlinkSync(outside, join(home, 'trampolin'))
    const { body } = await list(join(home, 'trampolin'))
    expect(body.code).toBe('folder_outside_roots')
  })

  it('does not even NAME an entry whose link leaves the roots', async () => {
    symlinkSync(outside, join(home, 'trampolin'))
    symlinkSync(join(outside, 'secret'), join(home, 'otro'))
    const { raw } = await list(home)
    expect(raw).not.toMatch(/trampolin|otro/)
  })

  it('does name a link that stays inside the roots', async () => {
    symlinkSync(join(home, 'Campus'), join(home, 'atajo'))
    const { body } = await list(home)
    expect(body.dirs).toContain('atajo')
  })

  it('a link to a FILE is not a directory and is not listed', async () => {
    symlinkSync(join(home, 'archivo.txt'), join(home, 'enlace'))
    const { body } = await list(home)
    expect(body.dirs).not.toContain('enlace')
  })

  it('tells missing, not-a-folder and relative apart INSIDE the roots', async () => {
    expect((await list(join(home, 'nada'))).body.code).toBe('folder_not_found')
    expect((await list(join(home, 'archivo.txt'))).body.code).toBe('folder_not_directory')
    expect((await list('Campus')).body.code).toBe('folder_not_absolute')
  })

  it('an allowlist of its own is respected', async () => {
    sessions = new VaultSessions({ allowedRoots: [outside] })
    expect((await list(outside)).body.dirs).toEqual(['secret'])
    expect((await list(home)).body.code).toBe('folder_outside_roots')
  })

  it('with no usable root, nothing can be listed', async () => {
    sessions = new VaultSessions({ allowedRoots: [] })
    expect((await list()).body.code).toBe('folder_outside_roots')
  })
})

describe('the same guard as every other endpoint', () => {
  it('refuses a missing or wrong capability, before parsing', async () => {
    const res = await call({ path: home }, { headers: { 'x-campus-capability': undefined } })
    expect(res.status).toBe(401)
    expect(res.body).not.toContain('Campus')
  })

  it('refuses a foreign origin', async () => {
    const res = await call({ path: home }, { headers: { origin: 'http://evil.example' } })
    expect(res.status).toBe(403)
    expect(JSON.parse(res.body).code).toBe('origin_not_allowed')
  })

  it('refuses a non-POST method', async () => {
    const res = await call({ path: home }, { method: 'GET' })
    expect(res.status).toBe(405)
  })

  it('refuses a non-string path', async () => {
    const res = await call({ path: 42 })
    expect(res.status).toBe(400)
    expect(JSON.parse(res.body).code).toBe('bad_request')
  })
})
