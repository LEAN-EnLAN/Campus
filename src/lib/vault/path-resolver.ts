/**
 * VAULT-001 — path resolution is the security boundary.
 *
 * This module is the *first* half of that boundary and it is deliberately pure:
 * it judges a requested path as a string, before any I/O. The second half lives
 * in the repository, because no amount of string analysis can tell you where a
 * symlink points.
 *
 * Both halves are required. Validating the string and then trusting the
 * filesystem is how traversal bugs ship; calling `realpath` on an unvalidated
 * string means the malformed name already reached the syscall.
 *
 * Windows rules are applied EVERYWHERE, on purpose. `docs/vault-format.md`
 * promises that a vault created on Linux opens on Windows. A resolver that is
 * permissive on Linux does not enforce that promise — it defers the failure to
 * the student who syncs their vault to a laptop.
 */

/** Windows MAX_PATH, minus room for the vault root the caller will prepend. */
const MAX_RELATIVE_PATH = 200

/** Reserved DOS device names. Still special on modern Windows. */
const RESERVED = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`),
])

const FORBIDDEN_CHARS = /[<>:"|?*]/

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export type PathRejection = { ok: false; reason: string }
export type PathAcceptance = { ok: true; segments: string[] }
export type PathVerdict = PathAcceptance | PathRejection

const no = (reason: string): PathRejection => ({ ok: false, reason })

/**
 * Is this single path component safe to place inside a vault?
 *
 * Every rule in the resolver reduces to this one function. Keeping it separate
 * means the rules are testable in isolation and cannot silently diverge between
 * "the path a student typed" and "the path a rename is moving to".
 */
export function isSafeSegment(segment: string): boolean {
  return segmentReason(segment) === null
}

function segmentReason(segment: string): string | null {
  if (segment.length === 0) return 'empty segment'
  if (segment === '.' || segment === '..') return 'path traversal is refused'

  // Checked before anything else: a separator inside what should be a single
  // component means the caller already lost track of its own structure.
  if (segment.includes('/') || segment.includes('\\')) return 'segment contains a separator'

  if (CONTROL_CHARS.test(segment)) return 'name contains a control character'
  if (FORBIDDEN_CHARS.test(segment)) return 'name contains a forbidden character'

  // Windows strips trailing dots and spaces, so "nota .md" and "nota.md" resolve
  // to the same file. Two vault entries collapsing into one is data loss, not a
  // cosmetic problem.
  if (/[. ]$/.test(segment)) return 'name has a trailing dot or space'

  // The device name is reserved with OR without an extension, but only when it
  // is the whole stem — "CONtabilidad" is an ordinary subject folder.
  const stem = segment.split('.')[0]!.toUpperCase()
  if (RESERVED.has(stem)) return `"${stem}" is a reserved device name`

  return null
}

/**
 * Validate a vault-relative path and return its normalised segments.
 *
 * Accepts sloppy-but-harmless input (`./a/./b`, a trailing slash) because
 * callers that join strings produce it. Rejects anything that could name a
 * location outside the vault, and anything Windows would rewrite behind our back.
 */
export function validateVaultPath(input: string): PathVerdict {
  if (typeof input !== 'string' || input.length === 0) return no('empty path')

  // Backslash is a separator on Windows. Treating it as an ordinary character
  // lets `..\..\etc` through as a single "filename" that Windows then splits —
  // the classic separator-confusion bypass. Normalise it into a separator here
  // so the traversal check below actually sees the `..`.
  const unified = input.split('\\').join('/')

  // Absolute forms are checked on the UNIFIED string so that `\\server\share`
  // and `C:\...` are both caught, whichever slash the caller used.
  if (unified.startsWith('/')) {
    // A leading slash is only "absolute" when something follows it that is not
    // just sloppiness. `/etc/passwd` escapes; the caller's stray prefix does not
    // — but we refuse both, because accepting one means guessing intent.
    return no('absolute paths are not vault-relative')
  }
  if (/^[a-zA-Z]:/.test(unified)) return no('absolute paths are not vault-relative')

  if (input.length > MAX_RELATIVE_PATH) return no('path is too long for the Windows limit')

  const raw = unified.split('/')
  const segments: string[] = []

  for (let i = 0; i < raw.length; i += 1) {
    const seg = raw[i]!

    // A trailing slash produces one empty tail segment. That is sloppiness, not
    // an attack, and rejecting it would break ordinary directory paths.
    if (seg === '' && i === raw.length - 1 && segments.length > 0) continue
    if (seg === '.') continue

    const reason = segmentReason(seg)
    if (reason !== null) return no(reason)

    segments.push(seg)
  }

  if (segments.length === 0) return no('empty path')

  // Belt and braces: `..` is already refused per segment, but the whole point of
  // this function is that nothing downstream has to re-derive that.
  if (segments.includes('..')) return no('path traversal is refused')

  return { ok: true, segments }
}
