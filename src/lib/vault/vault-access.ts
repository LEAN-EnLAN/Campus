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
}
