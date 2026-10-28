import {
  lstatSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync as nativeSymlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

/**
 * Exercise real filesystem links in security tests on both platforms.
 * Windows directory junctions are reparse points whose lstat is a symlink,
 * and can be created without elevation. File/dangling links MUST retain
 * native symlink semantics: hardlinks or mocks would defeat escape checks.
 */
export function symlinkSync(target: string, linkPath: string): void {
  if (process.platform !== 'win32') {
    nativeSymlinkSync(target, linkPath)
    return
  }
  const resolved = isAbsolute(target) ? target : resolve(dirname(linkPath), target)
  let directory = false
  try {
    directory = statSync(resolved).isDirectory()
  } catch {
    // Keep dangling links genuine. Without Developer Mode Windows reports EPERM.
  }
  nativeSymlinkSync(directory ? resolved : target, linkPath, directory ? 'junction' : 'file')
}

/**
 * Probe the EXACT filesystem operation required by file-link security cases.
 * A junction is only a directory link and MUST NOT stand in for a file link.
 *
 * On ordinary Windows accounts without Developer Mode / SeCreateSymbolicLinkPrivilege,
 * native file symlinks fail before Campus can be exercised. Expose that fact to
 * Vitest's skipIf so the skipped cases remain registered and run on CI POSIX or
 * Windows machines with privileges. Only the permission-denied probe is optional;
 * unexpected IO errors should fail the suite instead of concealing a regression.
 */
export function canCreateNativeFileSymlink(): boolean {
  if (process.platform !== 'win32') return true
  const folder = mkdtempSync(join(tmpdir(), 'campus-file-symlink-probe-'))
  try {
    const original = join(folder, 'original.txt')
    const link = join(folder, 'link.txt')
    writeFileSync(original, 'real file symlink probe')
    try {
      nativeSymlinkSync(original, link, 'file')
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EPERM' || code === 'EACCES') return false
      throw error
    }
    if (!lstatSync(link).isSymbolicLink()) {
      throw new Error('native file symlink probe unexpectedly produced a non-symlink')
    }
    return true
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

export const nativeFileSymlinksAvailable = canCreateNativeFileSymlink()
