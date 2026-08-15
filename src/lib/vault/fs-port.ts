/**
 * The filesystem port.
 *
 * `VaultRepository` is written against this and never against `node:fs`, for one
 * concrete reason: VAULT-001/002/003 demand `realpath`, an fsynced rename and a
 * re-stat before write. The browser's File System Access API cannot provide any
 * of the three, so the vault runs on a Node adapter behind a dev-server route
 * today and behind Tauri in Milestone D — the same port, no rewrite.
 *
 * Keeping the port this small is deliberate. Every method here is a capability
 * the vault genuinely needs; anything wider becomes an attack surface that the
 * path resolver then has to defend for no benefit.
 */

export type EntryKind = 'file' | 'dir' | 'symlink' | 'other'

export interface FileStat {
  readonly kind: EntryKind
  readonly size: number
  /** Milliseconds. The value VAULT-003 compares against before overwriting. */
  readonly mtimeMs: number
}

export interface DirEntry {
  readonly name: string
  readonly kind: EntryKind
}

export interface FileSystemPort {
  /**
   * Resolve every symlink in `absolute`. Rejects if the path does not exist.
   *
   * This is the half of the security boundary a string cannot provide, and the
   * reason the port exists at all.
   */
  realpath(absolute: string): Promise<string>

  /**
   * Stat WITHOUT following symlinks. Returns `null` when the entry is absent.
   *
   * Absence is a normal answer, not an exception — a repository that has to
   * catch to ask "does this exist" ends up swallowing real errors alongside it.
   */
  lstat(absolute: string): Promise<FileStat | null>

  /** The literal target of a symlink, which may not exist. */
  readlink(absolute: string): Promise<string>

  readFile(absolute: string): Promise<string>

  /**
   * Write to a temporary file in the SAME directory, fsync it, then rename over
   * the target (VAULT-002). Same directory matters: a rename across filesystems
   * is a copy, and a copy is not atomic.
   */
  writeFileAtomic(absolute: string, contents: string): Promise<void>

  mkdirp(absolute: string): Promise<void>
  readdir(absolute: string): Promise<DirEntry[]>
  rename(from: string, to: string): Promise<void>
  remove(absolute: string): Promise<void>

  /** Path arithmetic belongs to the adapter, so the repository stays portable. */
  join(...parts: string[]): string
  dirname(absolute: string): string
}
