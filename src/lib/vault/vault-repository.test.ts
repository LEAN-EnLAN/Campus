import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { nodeFileSystem } from './node-fs'
import { VaultRepository, VaultConflictError } from './vault-repository'

/**
 * VAULT-001/002/003 against a real filesystem.
 *
 * These use real temp directories and real symlinks on purpose. A mocked
 * filesystem would agree with whatever the implementation believes, and the
 * whole point of this layer is that the filesystem does NOT agree with strings.
 */

let root: string
let outside: string
let repo: VaultRepository

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), 'campus-vault-'))
  root = join(base, 'Campus')
  outside = join(base, 'outside')
  mkdirSync(join(root, 'Materias'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), 'not yours\n')
  repo = new VaultRepository(nodeFileSystem, root)
})

afterEach(() => {
  rmSync(join(root, '..'), { recursive: true, force: true })
})

describe('resolve — the boundary a string cannot enforce', () => {
  it('accepts an ordinary path inside the vault', async () => {
    const r = await repo.resolve('Materias/nota.md')
    expect(r.ok).toBe(true)
  })

  it('rejects traversal before touching the filesystem', async () => {
    const r = await repo.resolve('Materias/../../etc/passwd')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/traversal/i)
  })

  it('refuses to follow a symlink that points outside the vault', async () => {
    symlinkSync(join(outside, 'secret.txt'), join(root, 'Materias', 'leak.md'))
    const r = await repo.resolve('Materias/leak.md')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/outside the vault/i)
  })

  it('refuses a DANGLING symlink that points outside the vault', async () => {
    // The bug this exists to prevent: existence checks follow symlinks, so a
    // link whose target does not exist reports "absent", resolution gets
    // skipped, and the literal in-vault path sails through. The target can be
    // created a second later, and the intent was already outside.
    symlinkSync(
      join(outside, 'does-not-exist-yet.txt'),
      join(root, 'Materias', 'future-leak.md'),
    )
    const r = await repo.resolve('Materias/future-leak.md')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/outside the vault/i)
  })

  it('refuses a symlinked DIRECTORY that points outside the vault', async () => {
    symlinkSync(outside, join(root, 'Escapada'))
    const r = await repo.resolve('Escapada/secret.txt')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/outside the vault/i)
  })

  it('allows a symlink that stays inside the vault', async () => {
    // Students do symlink things. Refusing every link would be security theatre
    // that breaks real vaults; the rule is about the destination, not the kind.
    writeFileSync(join(root, 'Materias', 'real.md'), '# real\n')
    symlinkSync(join(root, 'Materias', 'real.md'), join(root, 'Materias', 'alias.md'))
    const r = await repo.resolve('Materias/alias.md')
    expect(r.ok).toBe(true)
  })

  it('rejects a rename target outside the vault', async () => {
    writeFileSync(join(root, 'Materias', 'nota.md'), '# nota\n')
    await expect(repo.rename('Materias/nota.md', '../outside/stolen.md')).rejects.toThrow(
      /traversal|outside/i,
    )
  })
})

describe('writeNote — VAULT-002 atomic, VAULT-003 never silently overwrite', () => {
  it('writes and reads back', async () => {
    await repo.writeNote('Materias/nota.md', '# hola\n', null)
    const read = await repo.readNote('Materias/nota.md')
    expect(read.contents).toBe('# hola\n')
  })

  it('leaves no temporary files behind', async () => {
    await repo.writeNote('Materias/nota.md', '# hola\n', null)
    const entries = await nodeFileSystem.readdir(join(root, 'Materias'))
    expect(entries.map((e) => e.name)).toEqual(['nota.md'])
  })

  it('creates missing parent folders inside the vault', async () => {
    await repo.writeNote('Materias/Arquitectura/clase-01.md', '# pipeline\n', null)
    expect(readFileSync(join(root, 'Materias', 'Arquitectura', 'clase-01.md'), 'utf8')).toBe(
      '# pipeline\n',
    )
  })

  it('refuses to overwrite a file that changed on disk after it was loaded', async () => {
    const target = join(root, 'Materias', 'nota.md')
    await repo.writeNote('Materias/nota.md', 'v1\n', null)
    const loaded = await repo.readNote('Materias/nota.md')

    // Someone else edits it: git checkout, another editor, the student's own mv.
    writeFileSync(target, 'edited elsewhere\n')

    await expect(
      repo.writeNote('Materias/nota.md', 'v2\n', loaded.mtimeMs),
    ).rejects.toBeInstanceOf(VaultConflictError)
    // The decision belongs to the student, so the external edit must survive.
    expect(readFileSync(target, 'utf8')).toBe('edited elsewhere\n')
  })

  it('accepts the write when the file is unchanged since it was loaded', async () => {
    await repo.writeNote('Materias/nota.md', 'v1\n', null)
    const loaded = await repo.readNote('Materias/nota.md')
    await repo.writeNote('Materias/nota.md', 'v2\n', loaded.mtimeMs)
    expect(readFileSync(join(root, 'Materias', 'nota.md'), 'utf8')).toBe('v2\n')
  })

  it('refuses to create a file that appeared while the student was typing', async () => {
    // expectedMtime null means "I believe this is new". If it is not, the other
    // file is somebody's work and must not be clobbered.
    writeFileSync(join(root, 'Materias', 'nota.md'), 'someone else got here first\n')
    await expect(repo.writeNote('Materias/nota.md', 'mine\n', null)).rejects.toBeInstanceOf(
      VaultConflictError,
    )
  })

  it('re-stats rather than trusting the mtime it was handed', async () => {
    // A caller passing a fabricated future mtime must not be able to force a
    // write. The check is against what is on disk right now, not arithmetic.
    await repo.writeNote('Materias/nota.md', 'v1\n', null)
    await expect(
      repo.writeNote('Materias/nota.md', 'v2\n', Date.now() + 60_000),
    ).rejects.toBeInstanceOf(VaultConflictError)
  })
})
