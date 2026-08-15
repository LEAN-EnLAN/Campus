import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleVaultRequest, mintToken, PREFIX, VaultSessions } from './vault-api'

/**
 * The HTTP boundary cannot be used to get around A-07.
 *
 * These do NOT re-test the path resolver — `vault-repository.test.ts` owns
 * that. They test what a separate suite cannot: a hostile payload arriving over
 * the wire reaches the SAME rejection, so the chain holds end to end rather
 * than two pieces each being fine on their own.
 */

let root: string
let outside: string
let sessions: VaultSessions
let vaultId: string

const TOKEN = mintToken()
const ORIGIN = 'http://localhost:5173'
const OPTIONS = { allowedOrigins: [ORIGIN], token: TOKEN }

const post = (url: string, body: unknown, over: Record<string, string | undefined> = {}) =>
  handleVaultRequest(
    {
      method: 'POST',
      url,
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'x-campus-capability': TOKEN,
        ...over,
      },
      body: JSON.stringify(body),
    },
    sessions,
    OPTIONS,
  )

const read = (path: string) => post(`${PREFIX}/${vaultId}/op`, { op: 'readNote', path })
const write = (path: string, contents = 'x', expectedMtimeMs: number | null = null) =>
  post(`${PREFIX}/${vaultId}/op`, { op: 'writeNote', path, contents, expectedMtimeMs })

const parse = (body: string) => JSON.parse(body) as Record<string, unknown>

beforeEach(async () => {
  const base = mkdtempSync(join(tmpdir(), 'campus-api-'))
  root = join(base, 'Campus')
  outside = join(base, 'outside')
  mkdirSync(join(root, 'Materias'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), 'not yours\n')

  sessions = new VaultSessions()
  vaultId = (await sessions.open(root)).id
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

// ------------------------------------------------------------ the whole chain

describe('a manipulated browser payload is refused by the vault, not by the transport', () => {
  it('an absolute host path', async () => {
    const res = await read('/etc/passwd')
    expect(res.status).toBe(400)
    // The refusal comes from VaultRepository's resolver, which is the proof
    // that the transport delegates rather than duplicating the rules.
    expect(String(parse(res.body).error)).toMatch(/absolute/i)
  })

  it('traversal, including after a valid segment', async () => {
    for (const path of ['../outside/secret.txt', 'Materias/../../outside/secret.txt']) {
      const res = await read(path)
      expect(res.status).toBe(400)
      expect(String(parse(res.body).error)).toMatch(/traversal/i)
    }
  })

  it('a symlink escape', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(root, 'Materias', 'leak.md'))
    const res = await read('Materias/leak.md')
    expect(res.status).toBe(400)
    expect(String(parse(res.body).error)).toMatch(/outside the vault/i)
  })

  it('a DANGLING symlink escape', async () => {
    symlinkSync(join(outside, 'not-yet.txt'), join(root, 'Materias', 'future.md'))
    const res = await write('Materias/future.md', 'pwned')
    expect(res.status).toBe(400)
    expect(String(parse(res.body).error)).toMatch(/outside the vault/i)
    expect(existsSync(join(outside, 'not-yet.txt'))).toBe(false)
  })

  it('a symlinked DIRECTORY escape', async () => {
    symlinkSync(outside, join(root, 'Escapada'))
    const res = await read('Escapada/secret.txt')
    expect(res.status).toBe(400)
    expect(String(parse(res.body).error)).toMatch(/outside the vault/i)
  })

  it('a write outside the vault leaves nothing behind', async () => {
    const res = await write('../outside/planted.md', 'pwned')
    expect(res.status).toBe(400)
    expect(existsSync(join(outside, 'planted.md'))).toBe(false)
  })

  it('a Windows-shaped traversal', async () => {
    const res = await read('Materias\\..\\..\\outside\\secret.txt')
    expect(res.status).toBe(400)
  })

  it('and an ordinary path still works, so the guard is not just refusing everything', async () => {
    // Without this, every assertion above would pass on a transport that
    // rejected literally every request.
    expect((await write('Materias/nota.md', '# hola\n')).status).toBe(200)
    const res = await read('Materias/nota.md')
    expect((parse(res.body).value as { contents: string }).contents).toBe('# hola\n')
  })

  it('VAULT-003 survives the wire: a stale write is refused as a conflict', async () => {
    await write('Materias/nota.md', 'v1\n')
    const loaded = parse((await read('Materias/nota.md')).body).value as { mtimeMs: number }
    writeFileSync(join(root, 'Materias', 'nota.md'), 'edited elsewhere\n')

    const res = await write('Materias/nota.md', 'v2\n', loaded.mtimeMs)
    expect(res.status).toBe(400)
    // Typed as a conflict, not a generic failure: the student has two versions
    // of their own work and only they can decide.
    expect(parse(res.body).conflict).toBe(true)
    expect(readFileSync(join(root, 'Materias', 'nota.md'), 'utf8')).toBe('edited elsewhere\n')
  })
})

// -------------------------------------------------------------------- access

describe('the endpoint is not reachable by any page that happens to find it', () => {
  it('refuses an unlisted origin, before considering the capability', async () => {
    const res = await handleVaultRequest(
      {
        method: 'POST',
        url: `${PREFIX}/${vaultId}/op`,
        headers: { origin: 'https://evil.example', 'x-campus-capability': TOKEN },
        body: JSON.stringify({ op: 'readNote', path: 'Materias/nota.md' }),
      },
      sessions,
      OPTIONS,
    )
    expect(res.status).toBe(403)
    // A caller who should not be here learns nothing about what is here.
    expect(res.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('never answers with a wildcard CORS origin', async () => {
    const res = await write('Materias/nota.md')
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN)
    expect(res.headers['access-control-allow-origin']).not.toBe('*')
  })

  it('refuses a missing or wrong capability', async () => {
    for (const token of [undefined, 'guessed']) {
      const res = await handleVaultRequest(
        {
          method: 'POST',
          url: `${PREFIX}/${vaultId}/op`,
          headers: { origin: ORIGIN, ...(token ? { 'x-campus-capability': token } : {}) },
          body: JSON.stringify({ op: 'readNote', path: 'Materias/nota.md' }),
        },
        sessions,
        OPTIONS,
      )
      expect(res.status).toBe(401)
    }
  })

  it('refuses an unknown vault id rather than reopening one', async () => {
    const res = await post(`${PREFIX}/AAAAAAAAAAAAAAAAAAAAAA/op`, {
      op: 'readNote',
      path: 'Materias/nota.md',
    })
    expect(res.status).toBe(404)
  })

  it('a session cannot be redirected by extra fields in the payload', async () => {
    // The id is random, not derived, so possessing the path grants nothing —
    // and honouring a path from the payload would put vault selection back in
    // the browser's hands, which is what this design exists to prevent.
    writeFileSync(join(root, 'Materias', 'nota.md'), '# nota\n')
    const res = await post(`${PREFIX}/${vaultId}/op`, {
      op: 'readNote',
      path: 'Materias/nota.md',
      root: outside,
      vaultPath: outside,
    })
    expect(res.status).toBe(200)
    expect((await read('../outside/secret.txt')).status).toBe(400)
  })
})

// ------------------------------------------------------------- surface shape

describe('the wire is VaultAccess, not a filesystem', () => {
  it('refuses every operation that is not one of the two', async () => {
    // These are not "blocked" — they do not exist. realpath, readdir and
    // rename were on the old port-shaped wire and are gone with it.
    for (const op of ['realpath', 'readdir', 'lstat', 'rename', 'remove', 'exec', 'readFile']) {
      const res = await post(`${PREFIX}/${vaultId}/op`, { op, path: 'Materias' })
      expect(res.status, `${op} was accepted`).toBe(400)
      expect(String(parse(res.body).error)).toMatch(/unsupported operation/i)
    }
  })

  it('refuses a non-string path or contents', async () => {
    expect(
      (await post(`${PREFIX}/${vaultId}/op`, { op: 'readNote', path: { x: 1 } })).status,
    ).toBe(400)
    expect(
      (await post(`${PREFIX}/${vaultId}/op`, { op: 'writeNote', path: 'a.md', contents: 42 }))
        .status,
    ).toBe(400)
  })

  it('refuses a non-numeric expectedMtimeMs rather than coercing it', async () => {
    const res = await post(`${PREFIX}/${vaultId}/op`, {
      op: 'writeNote',
      path: 'a.md',
      contents: 'x',
      expectedMtimeMs: 'whenever',
    })
    expect(res.status).toBe(400)
  })

  it('exposes no endpoint beyond open, exists and op', async () => {
    for (const url of [`${PREFIX}/list`, `${PREFIX}/${vaultId}`, '/__campus/fs/read']) {
      expect((await post(url, {})).status).toBe(404)
    }
  })

  it('refuses GET, so nothing here is reachable by navigating to a URL', async () => {
    const res = await handleVaultRequest(
      {
        method: 'GET',
        url: `${PREFIX}/${vaultId}/op`,
        headers: { origin: ORIGIN, 'x-campus-capability': TOKEN },
        body: '',
      },
      sessions,
      OPTIONS,
    )
    expect(res.status).toBe(405)
  })
})

describe('opening a vault', () => {
  it('returns an opaque id that does not contain the path', async () => {
    const opened = await sessions.open(root)
    expect(opened.id).not.toContain(root)
    expect(opened.id).not.toContain('/')
    expect(opened.name).toBe('Campus')
  })

  it('refuses a path that is not a directory', async () => {
    writeFileSync(join(root, 'file.txt'), 'x')
    expect((await post(`${PREFIX}/open`, { path: join(root, 'file.txt') })).status).toBe(404)
  })

  it('reports a missing vault without creating it', async () => {
    const gone = join(root, '..', 'moved-away')
    const res = await post(`${PREFIX}/exists`, { path: gone })
    expect(parse(res.body).exists).toBe(false)
    expect(existsSync(gone)).toBe(false)
  })
})
