import { delimiter, isAbsolute, parse, relative, resolve, sep } from 'node:path'

/**
 * Which folders the Vault API may open.
 *
 * The browser names an absolute path exactly once, at `open`. Without a policy
 * that path can be `/`, `/etc` or `~/.ssh`: the per-process token and the Origin
 * allowlist keep OTHER pages out, but they are not an authorisation boundary
 * against a script running in the app's own page. So the server decides.
 *
 * The default is the user's home directory — where a student's folders live —
 * and nothing wider. `CAMPUS_VAULT_ALLOWED_ROOTS` replaces it, and it has to be
 * written down by hand: absolute paths separated by the platform's path
 * delimiter (`:` on POSIX, `;` on Windows), like `PATH`. The same shape as
 * `CAMPUS_VAULT_ALLOWED_ORIGINS`: an escape hatch you can grep for, not a
 * default you can forget.
 */

export const ALLOWED_ROOTS_ENV = 'CAMPUS_VAULT_ALLOWED_ROOTS'

export interface ParsedRoots {
  /** Normalised, absolute. */
  roots: string[]
  /** Entries that were dropped, so the operator can be told. */
  rejected: string[]
}

/**
 * Parse the opt-in list.
 *
 * Strict on purpose, in the style of `extraAllowedOrigins`: an entry that could
 * never match a real path is dropped and REPORTED rather than kept, because a
 * value that is visibly "set" and silently matches nothing is the worst failure a
 * security knob can have. Anything not absolute is dropped (`~` is a shell
 * convenience, not a path), and so is the filesystem root, since an allowlist
 * containing `/` allows everything.
 *
 * When the variable IS set, the default home directory is not added back: an
 * explicit list means exactly that list, and a list that parses to nothing
 * allows nothing (fail closed) instead of quietly reverting to the default.
 */
export function parseAllowedRoots(raw: string | undefined, home: string): ParsedRoots {
  if (raw === undefined || raw.trim().length === 0) {
    return { roots: [resolve(home)], rejected: [] }
  }

  const roots: string[] = []
  const rejected: string[] = []
  for (const entry of raw.split(delimiter)) {
    const candidate = entry.trim()
    if (candidate.length === 0) continue
    if (candidate.includes('\0') || candidate.includes('*') || !isAbsolute(candidate)) {
      rejected.push(candidate)
      continue
    }
    const normalised = resolve(candidate)
    if (normalised === parse(normalised).root) {
      rejected.push(candidate)
      continue
    }
    if (!roots.includes(normalised)) roots.push(normalised)
  }
  return { roots, rejected }
}

/** Is `candidate` one of the roots, or inside one? Compared on whole path segments. */
export function isInsideAny(roots: readonly string[], candidate: string): boolean {
  const target = resolve(candidate)
  return roots.some((root) => {
    const rel = relative(root, target)
    return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
  })
}
