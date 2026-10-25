import { statSync, symlinkSync as nativeSymlinkSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

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
