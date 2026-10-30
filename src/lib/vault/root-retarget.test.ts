import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { VaultSessions } from '../../server/vault-api'
import type { VaultRepository } from './vault-repository'

let base: string
let root: string
let outside: string
let repo: VaultRepository
const linkType = process.platform === 'win32' ? 'junction' : 'dir'

beforeEach(async () => {
  base = mkdtempSync(join(tmpdir(), 'campus-retarget-'))
  root = join(base, 'vault')
  outside = join(base, 'outside')
  mkdirSync(root)
  mkdirSync(outside)
  writeFileSync(join(root, 'note.md'), 'inside')
  writeFileSync(join(outside, 'note.md'), 'outside')
  const sessions = new VaultSessions({ allowedRoots: [root] })
  const session = await sessions.open(root)
  repo = sessions.get(session.id)!.repo
})
afterEach(() => rmSync(base, { recursive: true, force: true }))

describe(`admitted vault root replaced by a real ${linkType}`, () => {
  const operations = {
    read: (vault: VaultRepository) => vault.readNote('note.md'),
    write: (vault: VaultRepository) => vault.writeNote('new.md', 'escaped', null),
    listRoot: (vault: VaultRepository) => vault.listDir(''),
    list: (vault: VaultRepository) => vault.list('folder'),
    rename: (vault: VaultRepository) => vault.rename('note.md', 'renamed.md'),
    trash: (vault: VaultRepository) => vault.trash('note.md'),
    stat: (vault: VaultRepository) => vault.stat('note.md'),
    mkdir: (vault: VaultRepository) => vault.mkdir('new-folder'),
  }
  it.each(Object.entries(operations))(
    'refuses %s without touching outside data',
    async (_name, operation) => {
      mkdirSync(join(outside, 'folder'))
      renameSync(root, join(base, 'original-vault'))
      symlinkSync(outside, root, linkType)
      await expect(operation(repo)).rejects.toMatchObject({ code: 'outside_vault' })
      expect(readFileSync(join(outside, 'note.md'), 'utf8')).toBe('outside')
      expect(readdirSync(outside).sort()).toEqual(['folder', 'note.md'])
      expect(readFileSync(join(base, 'original-vault', 'note.md'), 'utf8')).toBe('inside')
    },
  )

  it('still permits originally valid in-vault directory links', async () => {
    mkdirSync(join(root, 'real'))
    symlinkSync(join(root, 'real'), join(root, 'alias'), linkType)
    await repo.writeNote('alias/new.md', 'safe', null)
    expect((await repo.readNote('alias/new.md')).contents).toBe('safe')
    expect(readFileSync(join(root, 'real/new.md'), 'utf8')).toBe('safe')
  })

  it('admits a selected directory link and pins its physical root', async () => {
    const alias = join(base, 'selected-link')
    symlinkSync(root, alias, linkType)
    const sessions = new VaultSessions({ allowedRoots: [base] })
    const session = await sessions.open(alias)
    const selected = sessions.get(session.id)!.repo
    expect((await selected.readNote('note.md')).contents).toBe('inside')
    renameSync(root, join(base, 'original-vault'))
    symlinkSync(outside, root, linkType)
    await expect(selected.listDir('')).rejects.toMatchObject({ code: 'outside_vault' })
  })
})
