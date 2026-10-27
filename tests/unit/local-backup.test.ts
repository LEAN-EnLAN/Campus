import { spawnSync } from 'node:child_process'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'

const script = resolve(process.cwd(), 'scripts/local-backup.mjs')
const roots: string[] = []

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'campus-local-backup-'))
  roots.push(root)
  const vault = join(root, 'vault')
  mkdirSync(join(vault, '.campus', 'academic'), { recursive: true })
  mkdirSync(join(vault, 'Notas', 'Carpeta vacía'), { recursive: true })
  writeFileSync(join(vault, '.campus', 'academic', 'context.json'), '{"program":"UTN"}\n')
  writeFileSync(join(vault, 'Notas', 'Álgebra.md'), '# Apunte de prueba\n')
  return { root, vault, backup: join(root, 'snapshot'), restored: join(root, 'recovered') }
}

const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 20000 })

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('LOCAL backup and restore — actual filesystem and CLI', () => {
  it('backs up a vault, verifies SHA-256, restores a new vault including empty directories', () => {
    const { vault, backup, restored } = fixture()
    expect(run('backup', vault, backup).status).toBe(0)
    expect(run('verify', backup).status).toBe(0)
    const restoredResult = run('restore', backup, restored)
    expect(restoredResult.stderr).toBe('')
    expect(restoredResult.status).toBe(0)
    expect(readFileSync(join(restored, 'Notas', 'Álgebra.md'), 'utf8')).toBe(
      '# Apunte de prueba\n',
    )
    expect(
      readFileSync(join(restored, '.campus', 'academic', 'context.json'), 'utf8'),
    ).toContain('UTN')
    expect(lstatSync(join(restored, 'Notas', 'Carpeta vacía')).isDirectory()).toBe(true)
    expect(run('restore', backup, restored).status).toBe(1)
    expect(run('verify', backup).status).toBe(0)
  })

  it('blocks corrupt content before restoration, without leaving a destination', () => {
    const { vault, backup, restored } = fixture()
    expect(run('backup', vault, backup).status).toBe(0)
    writeFileSync(join(backup, 'data', 'Notas', 'Álgebra.md'), '# cambiado')
    expect(run('verify', backup).stderr).toContain('backup integrity mismatch')
    expect(run('restore', backup, restored).status).toBe(1)
    expect(existsSync(restored)).toBe(false)
  })

  it('refuses a manifest traversal and leaves the outside file untouched', () => {
    const { root, vault, backup, restored } = fixture()
    expect(run('backup', vault, backup).status).toBe(0)
    const outside = join(root, 'guard.txt')
    writeFileSync(outside, 'unchanged')
    const manifestPath = join(backup, 'manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.entries[0].path = '../../guard.txt'
    writeFileSync(manifestPath, JSON.stringify(manifest))
    expect(run('restore', backup, restored).stderr).toContain('unsafe manifest entry')
    expect(readFileSync(outside, 'utf8')).toBe('unchanged')
    expect(existsSync(restored)).toBe(false)
  })

  it('refuses backup inside a vault and refuses restoring into its own snapshot', () => {
    const { vault, backup } = fixture()
    expect(run('backup', vault, join(vault, 'nested-backup')).stderr).toContain(
      'cannot overlap',
    )
    expect(run('backup', vault, backup).status).toBe(0)
    expect(run('restore', backup, join(backup, 'new-vault')).stderr).toContain('cannot overlap')
  })

  it('refuses directory symlinks or junctions to outside files, without copying the secret', () => {
    const { root, vault, backup } = fixture()
    const outside = join(root, 'outside')
    mkdirSync(outside)
    writeFileSync(join(outside, 'secret.txt'), 'must not be copied')
    const link = join(vault, 'escape')
    // On Windows, a REAL directory junction requires no Developer Mode;
    // POSIX uses a real directory symlink. Neither is a mock or a hardlink.
    symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir')
    const result = run('backup', vault, backup)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('symlink/junction')
    expect(existsSync(backup)).toBe(false)
  })

  it('refuses a symlink or junction planted in the snapshot after it was made', () => {
    const { root, vault, backup, restored } = fixture()
    expect(run('backup', vault, backup).status).toBe(0)
    const outside = join(root, 'outside')
    mkdirSync(outside)
    symlinkSync(
      outside,
      join(backup, 'data', 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    const result = run('restore', backup, restored)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('symlink/junction')
    expect(existsSync(restored)).toBe(false)
  })

  it('refuses a symlinked manifest instead of following it', () => {
    const { root, vault, backup, restored } = fixture()
    expect(run('backup', vault, backup).status).toBe(0)
    const manifest = join(backup, 'manifest.json')
    const outside = join(root, 'outside-manifest.json')
    renameSync(manifest, outside)
    if (process.platform === 'win32') {
      // A Windows junction is a genuine reparse point, even without the file
      // symlink privilege; a POSIX file symlink is exercised on CI Ubuntu.
      const dir = join(root, 'outside-manifest-dir')
      mkdirSync(dir)
      symlinkSync(dir, manifest, 'junction')
    } else symlinkSync(outside, manifest, 'file')
    expect(run('restore', backup, restored).stderr).toContain('manifest must be a regular file')
    expect(existsSync(restored)).toBe(false)
  })
})
