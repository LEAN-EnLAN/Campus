/**
 * What `LocalBackend` actually needs from a vault. Nothing else.
 *
 * Derived from the real call sites rather than designed: `academic-store.ts` —
 * the only module that touches the vault — calls `readNote` and `writeNote`,
 * and that is the entire list. `rename` and `list` exist on `VaultRepository`
 * and are deliberately NOT here, because a boundary sized for imagined callers
 * is a boundary that has to defend operations nobody asked for.
 *
 * The point of extracting it: there must be exactly ONE filesystem security
 * authority, and it lives on the privileged side.
 *
 *     LOCAL   LocalBackend → VaultAccess → VaultRepository → FileSystemPort → disk
 *     REMOTE  LocalBackend → VaultAccess → HttpVaultAccess → HTTP
 *                                        → VaultRepository → FileSystemPort → disk
 *
 * In both shapes `VaultRepository` is the same single authority. The browser
 * does not re-derive path safety, because client-side path checks are theatre:
 * a compromised page skips them, and two boundaries eventually disagree about
 * which paths are legal.
 *
 * This interface therefore exposes SEMANTIC operations inside an already-chosen
 * vault. It has no `realpath`, no absolute root, no raw handles, no way to
 * address anything by host path.
 */

export interface LoadedNote {
  readonly contents: string
  /** Hand back to `writeNote` so the write can prove nothing moved underneath it. */
  readonly mtimeMs: number
}

export interface VaultEntry {
  readonly name: string
  readonly kind: 'file' | 'dir'
  /** Milliseconds. What conflict detection compares against. */
  readonly mtimeMs: number
  readonly size: number
}

export interface VaultStat {
  readonly kind: 'file' | 'dir'
  readonly mtimeMs: number
  readonly size: number
}

export interface TrashedEntry {
  /** Vault-relative path where the content now lives, under .campus/trash/. */
  readonly trashedTo: string
}

export interface VaultAccess {
  /** Read a vault-relative note. Rejects if the path escapes the vault. */
  readNote(relative: string): Promise<LoadedNote>

  /**
   * Write a vault-relative note atomically.
   *
   * `expectedMtimeMs` is what the caller believes it loaded; `null` means "I
   * believe this file does not exist". Either belief is checked against disk
   * immediately before writing (VAULT-003).
   */
  writeNote(relative: string, contents: string, expectedMtimeMs: number | null): Promise<void>

  /**
   * List a directory. `.campus/` is omitted at the vault root: it is Campus's
   * own state, and the explorer shows the student THEIR files.
   */
  listDir(relative: string): Promise<VaultEntry[]>

  /** Create a folder (and parents). Idempotent. */
  mkdir(relative: string): Promise<void>

  /**
   * Rename or move. REFUSES if the destination exists: POSIX rename replaces
   * the target atomically, which for a student means "renaming a.md onto b.md
   * deleted my b.md". The filesystem's default is the data-loss bug.
   */
  rename(from: string, to: string): Promise<void>

  /**
   * VAULT-005 — trash, not unlink. Moves into `.campus/trash/` with a metadata
   * sidecar recording the original path, so restoring is possible by hand with
   * any file manager. Trash is canonical student data, never silently emptied.
   */
  trash(relative: string): Promise<TrashedEntry>

  /** Kind and mtime, or `null` when absent. Absence is an answer, not an error. */
  stat(relative: string): Promise<VaultStat | null>
}
