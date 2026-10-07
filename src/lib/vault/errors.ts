/**
 * Stable error codes for everything the Vault can refuse.
 *
 * The privileged side decides WHAT went wrong and says so with a code; it never
 * writes prose for a student. The UI decides how to say it, in Spanish, from the
 * code alone (`error-messages.ts`). Matching on English message text is what this
 * replaces: a reworded message used to silently change behaviour in the editor.
 *
 * Codes are append-only. They cross an HTTP boundary, so renaming one is a
 * breaking change for any client that is a version behind.
 */
export const VAULT_ERROR_CODES = [
  // A vault-relative path (or a name) that fails validation.
  'path_empty',
  'path_absolute',
  'path_traversal',
  'path_too_long',
  'name_separator',
  'name_control_char',
  'name_forbidden_char',
  'name_trailing_dot_space',
  'name_reserved',
  // Where the path really lands.
  'outside_vault',
  'too_many_links',
  'symlink_unreadable',
  'root_unreadable',
  // What is on disk.
  'not_found',
  'already_exists',
  'destination_exists',
  'conflict_changed',
  'conflict_missing',
  'permission_denied',
  'io_error',
  // Opening a folder as a Vault.
  'folder_not_absolute',
  'folder_not_found',
  'folder_not_directory',
  'folder_outside_roots',
  // The transport.
  'unauthorized',
  'origin_not_allowed',
  'unknown_vault',
  'bad_request',
  'unavailable',
  'unknown',
] as const

export type VaultErrorCode = (typeof VAULT_ERROR_CODES)[number]

export function isVaultErrorCode(value: unknown): value is VaultErrorCode {
  return typeof value === 'string' && (VAULT_ERROR_CODES as readonly string[]).includes(value)
}

/**
 * A refusal with a code. `message` is English, for logs and developers only: it
 * must never be shown to a student and never contain an absolute host path.
 */
export class VaultError extends Error {
  readonly code: VaultErrorCode

  constructor(code: VaultErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'VaultError'
    this.code = code
  }
}

/**
 * VAULT-003. Not an ordinary error: it means the student has two versions of
 * their own work and only they can decide which one survives.
 */
export class VaultConflictError extends VaultError {
  readonly path: string
  readonly detail: string

  constructor(
    path: string,
    detail: string,
    code: Extract<
      VaultErrorCode,
      'already_exists' | 'destination_exists' | 'conflict_changed' | 'conflict_missing'
    > = 'conflict_changed',
  ) {
    super(code, `${path}: ${detail}`)
    this.name = 'VaultConflictError'
    this.path = path
    this.detail = detail
  }
}

/** The code of whatever was thrown, or `unknown` for anything that is not ours. */
export function vaultErrorCode(error: unknown): VaultErrorCode {
  if (error instanceof VaultError) return error.code
  return 'unknown'
}

/**
 * Whatever a filesystem call threw, as a coded error that carries NO text from
 * the original. Node's messages embed absolute host paths (`ENOENT: no such
 * file or directory, rename '/home/…'`), so the original message is dropped on
 * purpose: only the errno survives, as a code.
 */
export function vaultErrorFromSystem(error: unknown): VaultError {
  if (error instanceof VaultError) return error
  const errno = (error as { code?: unknown } | null)?.code
  switch (errno) {
    case 'ENOENT':
    case 'ENOTDIR':
      return new VaultError('not_found', 'not found')
    case 'EACCES':
    case 'EPERM':
    case 'EROFS':
      return new VaultError('permission_denied', 'permission denied')
    case 'ENAMETOOLONG':
      return new VaultError('path_too_long', 'path is too long')
    case 'ELOOP':
      return new VaultError('too_many_links', 'too many symbolic links')
    case 'EEXIST':
    case 'ENOTEMPTY':
      return new VaultError('destination_exists', 'the destination already exists')
    default:
      return new VaultError('io_error', 'the operation failed')
  }
}
