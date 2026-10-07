import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { VAULT_ERROR_CODES, VaultConflictError, VaultError, vaultErrorCode } from './errors'
import { vaultErrorMessage } from './error-messages'
import { nodeFileSystem } from './node-fs'
import { validateVaultPath } from './path-resolver'
import { VaultRepository } from './vault-repository'

/**
 * Stable error codes: the contract between the privileged side and the UI.
 *
 * The server never sends prose a student is meant to read, and the UI never
 * matches on English text. A code travels; Spanish is chosen where it is shown.
 */

const codeOf = (path: string) => {
  const verdict = validateVaultPath(path)
  return verdict.ok ? null : verdict.code
}

describe('path validation reports a code', () => {
  it.each([
    ['', 'path_empty'],
    ['../x', 'path_traversal'],
    ['a/../../x', 'path_traversal'],
    ['/etc/passwd', 'path_absolute'],
    ['C:\\Windows\\x', 'path_absolute'],
    ['C:/Windows/x', 'path_absolute'],
    ['a:b', 'name_forbidden_char'],
    ['A: Resumen', 'name_forbidden_char'],
    ['nota?.md', 'name_forbidden_char'],
    ['CON', 'name_reserved'],
    ['nul.md', 'name_reserved'],
    ['nota.', 'name_trailing_dot_space'],
    ['nota\u0001', 'name_control_char'],
    ['x'.repeat(201), 'path_too_long'],
  ])('%j is refused as %s', (path, code) => {
    expect(codeOf(path)).toBe(code)
  })

  it('does not call a note named "A: Resumen" an absolute path', () => {
    const verdict = validateVaultPath('A: Resumen')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).not.toMatch(/absolute/i)
  })
})

describe('the repository throws typed errors', () => {
  let base: string
  let root: string
  let outside: string
  let repo: VaultRepository

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'campus-codes-'))
    root = join(base, 'Campus')
    outside = join(base, 'outside')
    mkdirSync(join(root, 'Materias'), { recursive: true })
    mkdirSync(outside, { recursive: true })
    repo = new VaultRepository(nodeFileSystem, root)
  })

  afterEach(() => rmSync(base, { recursive: true, force: true }))

  const codeFrom = async (run: () => Promise<unknown>) => {
    try {
      await run()
    } catch (error) {
      return vaultErrorCode(error)
    }
    return 'did-not-throw'
  }

  it('refuses a symlink escape as outside_vault', async () => {
    symlinkSync(outside, join(root, 'esc'))
    expect(await codeFrom(() => repo.listDir('esc'))).toBe('outside_vault')
  })

  it('reports a missing note as not_found', async () => {
    expect(await codeFrom(() => repo.readNote('nada.md'))).toBe('not_found')
    expect(await codeFrom(() => repo.trash('nada.md'))).toBe('not_found')
  })

  it('reports creating over an existing note as already_exists, a conflict', async () => {
    await repo.writeNote('a.md', 'x', null)
    try {
      await repo.writeNote('a.md', 'y', null)
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(VaultConflictError)
      expect((error as VaultError).code).toBe('already_exists')
    }
  })

  it('reports a stale write as conflict_changed and a vanished file as conflict_missing', async () => {
    await repo.writeNote('a.md', 'x', null)
    const { mtimeMs } = await repo.readNote('a.md')
    writeFileSync(join(root, 'a.md'), 'changed')
    expect(await codeFrom(() => repo.writeNote('a.md', 'mine', mtimeMs - 1000))).toBe(
      'conflict_changed',
    )
    expect(await codeFrom(() => repo.writeNote('gone.md', 'mine', 123))).toBe(
      'conflict_missing',
    )
  })

  it('reports renaming onto an existing entry as destination_exists', async () => {
    await repo.writeNote('a.md', 'x', null)
    await repo.writeNote('b.md', 'y', null)
    expect(await codeFrom(() => repo.rename('a.md', 'b.md'))).toBe('destination_exists')
  })

  it('carries path-validation codes through', async () => {
    expect(await codeFrom(() => repo.writeNote('CON.md', 'x', null))).toBe('name_reserved')
    expect(await codeFrom(() => repo.writeNote('../x.md', 'x', null))).toBe('path_traversal')
  })

  it('does not put the vault-relative path in the message twice', async () => {
    try {
      await repo.writeNote('CON.md', 'x', null)
    } catch (error) {
      const message = (error as Error).message
      expect(message.split('CON.md').length - 1).toBeLessThanOrEqual(1)
    }
  })

  it('trashes a note whose file name is very long', async () => {
    const name = `${'n'.repeat(180)}.md`
    await repo.writeNote(name, 'x', null)
    const trashed = await repo.trash(name)
    expect(trashed.trashedTo.startsWith('.campus/trash/')).toBe(true)
    expect((await repo.stat(trashed.trashedTo))?.kind).toBe('file')
  })
})

describe('vaultErrorMessage', () => {
  it('has one Spanish sentence for every code', () => {
    for (const code of VAULT_ERROR_CODES) {
      const message = vaultErrorMessage(new VaultError(code, 'irrelevant english'))
      expect(message, code).toMatch(/^[¡¿A-ZÁÉÍÓÚÑ]/)
      expect(message, code).toMatch(/[.!?*]$/)
      expect(message, code).not.toMatch(/\.md|\/tmp|\/home|irrelevant/)
      // One sentence per case. The picker's "No encontramos esa carpeta. Revisá
      // la ruta." is the brief's own wording for the one place that has two.
      const sentences = message.replace(/\.\.\./g, '').split(/[.!?]\s+[A-ZÁÉÍÓÚ¡¿]/).length
      expect(sentences, code).toBeLessThanOrEqual(code === 'folder_not_found' ? 2 : 1)
    }
  })

  it('gives the cases of the brief their own sentences', () => {
    expect(vaultErrorMessage(new VaultError('already_exists'))).toBe(
      'Ya existe una nota con ese nombre.',
    )
    expect(vaultErrorMessage(new VaultError('name_forbidden_char'))).toBe(
      'Ese nombre no es válido: no uses : < > " | ? *',
    )
    expect(vaultErrorMessage(new VaultError('name_reserved'))).toBe(
      'Ese nombre está reservado por Windows.',
    )
    expect(vaultErrorMessage(new VaultError('conflict_missing'))).toBe(
      'Esta nota se movió o se eliminó.',
    )
  })

  it('never leaks the text of an unknown or foreign error', () => {
    const leaked = vaultErrorMessage(
      new Error("ENOENT: no such file or directory, rename '/tmp/campus/vault/nope.md'"),
    )
    expect(leaked).not.toMatch(/ENOENT|\/tmp|nope/)
    expect(leaked).toMatch(/probá de nuevo/)
    expect(vaultErrorMessage('boom')).toMatch(/probá de nuevo/)
    expect(vaultErrorMessage(new TypeError('Failed to fetch'))).toMatch(/servidor de Campus/)
  })
})
