import { backendError } from '@/lib/backends/types'
import type { VaultRepository } from '@/lib/vault/vault-repository'

/**
 * The four academic files, and the only way they are ever changed.
 *
 * Every mutation is read → validate → derive the next whole value → atomic
 * write, on ONE file. Nothing here touches two files, because a "transaction"
 * spanning two atomic writes is not a transaction: a crash between them leaves
 * the vault in a state no single file describes, and the student's own data is
 * what pays for it.
 *
 * Writes go through `VaultRepository`, never the filesystem. If this module
 * started resolving paths itself, VAULT-001 would stop being a boundary and
 * become a suggestion.
 */

export const SCHEMA_VERSION = 1

const DIR = '.campus/academic'

export type AcademicFile = 'context' | 'subject-state' | 'items' | 'resources'

/** Every file is an envelope, so the payload can change shape without ambiguity. */
interface Envelope<T> {
  schemaVersion: number
  [key: string]: unknown
  payload?: T
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
  vault: VaultRepository,
  file: AcademicFile,
  key: string,
  empty: T,
): Promise<{ value: T; mtimeMs: number | null }> {
  let raw: { contents: string; mtimeMs: number }
  try {
    raw = await vault.readNote(pathFor(file))
  } catch {
    // Absent is the ordinary state of a fresh vault, not a failure.
    return { value: empty, mtimeMs: null }
  }

  let parsed: Envelope<unknown>
  try {
    parsed = JSON.parse(raw.contents) as Envelope<unknown>
  } catch (error) {
    backendError(
      `No pudimos leer ${file}.json de tu vault`,
      `invalid JSON: ${(error as Error).message}`,
    )
  }

  const version = parsed.schemaVersion
  if (typeof version !== 'number') {
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

  const value = parsed[key]
  return { value: (value === undefined ? empty : value) as T, mtimeMs: raw.mtimeMs }
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
  vault: VaultRepository,
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
