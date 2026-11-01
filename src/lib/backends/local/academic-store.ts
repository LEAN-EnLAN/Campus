import { backendError } from '@/lib/backends/types'
import { VaultError } from '@/lib/vault/errors'
import type { VaultAccess } from '@/lib/vault/vault-access'

/**
 * The academic files, and the only way they are ever changed.
 *
 * Every mutation is read → validate → derive the next whole value → atomic
 * write, on ONE file. Nothing here touches two files, because a "transaction"
 * spanning two atomic writes is not a transaction: a crash between them leaves
 * the vault in a state no single file describes, and the student's own data is
 * what pays for it.
 *
 * Writes go through `VaultAccess`, never the filesystem. Which implementation
 * is behind it — the in-process repository, or the HTTP client that reaches the
 * privileged side — is not this module's business, and that is the point: there
 * is exactly one filesystem security authority and it is never in the browser.
 */

export const SCHEMA_VERSION = 1

const DIR = '.campus/academic'

export type AcademicFile =
  'context' | 'subject-state' | 'items' | 'resources' | 'manual-subjects'

/** Every file is an envelope, so the payload can change shape without ambiguity. */
interface Envelope {
  schemaVersion: number
  [key: string]: unknown
}

const pathFor = (file: AcademicFile) => `${DIR}/${file}.json`

/**
 * Read one file, or fall back to `empty` when the vault has never held it.
 *
 * A vault written by a newer Campus is refused rather than migrated or
 * partially understood — `docs/vault-format.md` promises read-only with an
 * explanation, and a silent migration of a file we do not understand is how a
 * student loses a semester.
 */
async function readFile<T>(
  vault: VaultAccess,
  file: AcademicFile,
  key: string,
  empty: T,
): Promise<{ value: T; mtimeMs: number | null }> {
  let raw: { contents: string; mtimeMs: number }
  try {
    raw = await vault.readNote(pathFor(file))
  } catch (error) {
    // Absent is the ordinary state of a fresh vault, not a failure.
    if (error instanceof VaultError && error.code === 'not_found') {
      return { value: empty, mtimeMs: null }
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.contents)
  } catch (error) {
    backendError(
      `No pudimos leer ${file}.json de tu vault`,
      `invalid JSON: ${(error as Error).message}`,
    )
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    backendError(`No pudimos leer ${file}.json de tu vault`, 'invalid envelope')
  }
  const envelope = parsed as Envelope
  const version = envelope.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    backendError(
      `El archivo ${file}.json de tu vault no declara su versión`,
      'missing schemaVersion',
    )
  }
  if (version > SCHEMA_VERSION) {
    backendError(
      `Tu vault fue escrito por una versión más nueva de Campus`,
      `${file}.json is schemaVersion ${version}, this build understands ${SCHEMA_VERSION}`,
    )
  }

  const value = envelope[key]
  // Validate only the envelope's collection/context shape, not domain rows.
  const valid = Array.isArray(empty)
    ? Array.isArray(value)
    : value === null || (typeof value === 'object' && !Array.isArray(value))
  if (!valid) backendError(`No pudimos leer ${file}.json de tu vault`, `invalid ${key} payload`)
  return { value: value as T, mtimeMs: raw.mtimeMs }
}

/**
 * Change one file atomically.
 *
 * The read happens inside the update, immediately before the write, so the
 * mtime handed to `writeNote` is the one that was actually just observed. A
 * caller reading earlier and writing later is exactly the lost-update the
 * VAULT-003 check exists to catch.
 */
async function update<T>(
  vault: VaultAccess,
  file: AcademicFile,
  key: string,
  empty: T,
  derive: (current: T) => T,
): Promise<void> {
  const { value, mtimeMs } = await readFile<T>(vault, file, key, empty)
  const next = derive(value)
  const body = JSON.stringify({ schemaVersion: SCHEMA_VERSION, [key]: next }, null, 2) + '\n'
  await vault.writeNote(pathFor(file), body, mtimeMs)
}

export const store = {
  read: readFile,
  update,
  path: pathFor,
}
