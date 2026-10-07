import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { nodeFileSystem } from './node-fs'
import { VaultRepository } from './vault-repository'

/**
 * VAULT-001 against CHAINED links.
 *
 * A single link is judged by its target. A chain is a link whose target is
 * another link: the first hop lands inside the vault, so a textual check
 * passes, and the kernel then follows the second hop to wherever it points.
 * These use real symlinks on a real filesystem because that disagreement
 * between strings and the kernel is the whole bug.
 */

let base: string
let root: string
let outside: string
let repo: VaultRepository

const OUTSIDE = /outside the vault/i

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'campus-chain-'))
  root = join(base, 'Campus')
  outside = join(base, 'outside')
  mkdirSync(join(root, 'Materias'), { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'secret.txt'), 'not yours\n')
  repo = new VaultRepository(nodeFileSystem, root)
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('two-hop file links', () => {
  beforeEach(() => {
    // b -> <outside file>; a -> b. `a` is a link to an in-vault link.
    symlinkSync(join(outside, 'secret.txt'), join(root, 'b'))
    symlinkSync('b', join(root, 'a'))
  })

  it('refuses to read through the chain', async () => {
    await expect(repo.readNote('a')).rejects.toThrow(OUTSIDE)
  })

  it('refuses to stat or write through the chain', async () => {
    await expect(repo.stat('a')).rejects.toThrow(OUTSIDE)
    await expect(repo.writeNote('a', 'pwned', 1)).rejects.toThrow(OUTSIDE)
    expect(readFileSync(join(outside, 'secret.txt'), 'utf8')).toBe('not yours\n')
  })

  it('refuses to trash the chain, so nothing outside is moved', async () => {
    await expect(repo.trash('a')).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'secret.txt'))).toBe(true)
  })
})

describe('two-hop directory links', () => {
  beforeEach(() => {
    symlinkSync(outside, join(root, 'd1'))
    symlinkSync('d1', join(root, 'd2'))
  })

  it('refuses to list through the chain', async () => {
    await expect(repo.listDir('d2')).rejects.toThrow(OUTSIDE)
  })

  it('refuses to read a file below the chain', async () => {
    await expect(repo.readNote('d2/secret.txt')).rejects.toThrow(OUTSIDE)
  })

  it('refuses to create a NEW file below the chain, and leaves nothing outside', async () => {
    await expect(repo.writeNote('d2/pwn.md', 'pwned', null)).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'pwn.md'))).toBe(false)
  })

  it('refuses to create a NEW file in a not-yet-existing folder below the chain', async () => {
    await expect(repo.writeNote('d2/new/deeper/pwn.md', 'pwned', null)).rejects.toThrow(OUTSIDE)
    expect(readdirSync(outside)).toEqual(['secret.txt'])
  })

  it('refuses mkdir below the chain', async () => {
    await expect(repo.mkdir('d2/made')).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'made'))).toBe(false)
  })

  it('refuses a rename whose destination is below the chain', async () => {
    writeFileSync(join(root, 'Materias', 'nota.md'), '# nota\n')
    await expect(repo.rename('Materias/nota.md', 'd2/stolen.md')).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'stolen.md'))).toBe(false)
    expect(existsSync(join(root, 'Materias', 'nota.md'))).toBe(true)
  })

  it('refuses a rename whose source is below the chain', async () => {
    await expect(repo.rename('d2/secret.txt', 'robbed.txt')).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'secret.txt'))).toBe(true)
  })

  it('refuses to trash something below the chain', async () => {
    await expect(repo.trash('d2/secret.txt')).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'secret.txt'))).toBe(true)
  })
})

describe('chains built from relative targets and dot-dot', () => {
  it('refuses a relative link that climbs out, reached through another link', async () => {
    symlinkSync('../../outside', join(root, 'Materias', 'up'))
    symlinkSync('Materias/up', join(root, 'go'))
    await expect(repo.readNote('go/secret.txt')).rejects.toThrow(OUTSIDE)
    await expect(repo.writeNote('go/x.md', 'x', null)).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'x.md'))).toBe(false)
  })

  it('refuses a link whose target climbs out through an in-vault link', async () => {
    // inner -> outside; esc -> inner/.. is physically `outside/..` = base.
    symlinkSync(outside, join(root, 'inner'))
    symlinkSync('inner/..', join(root, 'esc'))
    await expect(repo.listDir('esc')).rejects.toThrow(OUTSIDE)
  })

  it('refuses a chain of three links', async () => {
    symlinkSync(outside, join(root, 'l1'))
    symlinkSync('l1', join(root, 'l2'))
    symlinkSync('l2', join(root, 'l3'))
    await expect(repo.writeNote('l3/x.md', 'x', null)).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'x.md'))).toBe(false)
  })

  it('refuses a dangling chained link, so the target cannot be planted later', async () => {
    symlinkSync(join(outside, 'later.md'), join(root, 'b2'))
    symlinkSync('b2', join(root, 'a2'))
    await expect(repo.writeNote('a2', 'pwned', null)).rejects.toThrow(OUTSIDE)
    expect(existsSync(join(outside, 'later.md'))).toBe(false)
  })

  it('does not hang on a link loop, and refuses it', async () => {
    symlinkSync('y', join(root, 'x'))
    symlinkSync('x', join(root, 'y'))
    await expect(repo.readNote('x')).rejects.toThrow(/symbolic links|outside the vault/i)
  })
})

describe('chained links that stay inside the vault remain allowed', () => {
  it('reads through a chain of in-vault file links', async () => {
    writeFileSync(join(root, 'Materias', 'real.md'), '# real\n')
    symlinkSync(join(root, 'Materias', 'real.md'), join(root, 'one.md'))
    symlinkSync('one.md', join(root, 'two.md'))
    expect((await repo.readNote('two.md')).contents).toBe('# real\n')
  })

  it('writes a new file below a chain of in-vault directory links', async () => {
    symlinkSync('Materias', join(root, 'm1'))
    symlinkSync('m1', join(root, 'm2'))
    await repo.writeNote('m2/nueva.md', '# nueva\n', null)
    expect(readFileSync(join(root, 'Materias', 'nueva.md'), 'utf8')).toBe('# nueva\n')
  })
})
