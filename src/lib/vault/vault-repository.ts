import type { FileSystemPort } from './fs-port'
import { validateVaultPath } from './path-resolver'

/**
 * VAULT-001/002/003 — the vault, and the boundary around it.
 *
 * `path-resolver.ts` judges the requested string. This judges reality: where the
 * path actually lands once the filesystem has had its say. Both are required,
 * and neither is sufficient.
 */

export type ResolveResult = { ok: true; absolute: string } | { ok: false; reason: string }

/**
 * VAULT-003. Not an ordinary error: it means the student has two versions of
 * their own work and only they can decide which one survives.
 */
export class VaultConflictError extends Error {
  readonly path: string
  readonly detail: string

  constructor(path: string, detail: string) {
    super(`${path}: ${detail}`)
    this.name = 'VaultConflictError'
    this.path = path
    this.detail = detail
  }
}

export interface LoadedNote {
  readonly contents: string
  /** Pass this back to `writeNote` so the write can prove nothing moved underneath it. */
  readonly mtimeMs: number
}

export class VaultRepository {
  private readonly fs: FileSystemPort
  private readonly root: string

  constructor(fs: FileSystemPort, root: string) {
    this.fs = fs
    this.root = root
  }

  /**
   * Where does this vault-relative path really land?
   *
   * The order matters. Validate the string first, so a malformed name never
   * reaches a syscall. Then resolve the PARENT — never the full path — because
   * an existence check on the full path follows symlinks, and a link whose
   * target does not exist reports "absent". That gap is a real bypass: skip
   * resolution, and the literal in-vault path passes containment while the link
   * still points outside. The target can be created a second later.
   */
  async resolve(relative: string): Promise<ResolveResult> {
    const verdict = validateVaultPath(relative)
    if (!verdict.ok) return verdict

    let realRoot: string
    try {
      realRoot = await this.fs.realpath(this.root)
    } catch {
      return { ok: false, reason: 'vault root is not readable' }
    }

    const inside = (p: string) =>
      p === realRoot || p.startsWith(realRoot + '/') || p.startsWith(realRoot + '\\')

    // Walk segment by segment. A symlinked *directory* halfway down escapes just
    // as effectively as a symlinked file at the end, and only a walk catches it.
    let current = realRoot
    for (const segment of verdict.segments) {
      const candidate = this.fs.join(current, segment)
      const stat = await this.fs.lstat(candidate)

      if (stat?.kind === 'symlink') {
        // Judge the link by its TARGET, existing or not.
        let target: string
        try {
          target = await this.fs.readlink(candidate)
        } catch {
          return { ok: false, reason: 'symlink is not readable' }
        }
        const resolved = this.absolutise(target, current)
        if (!inside(resolved)) {
          return { ok: false, reason: 'path resolves outside the vault' }
        }
        current = resolved
        continue
      }

      if (stat === null) {
        // Not there yet — a note being created. Nothing to resolve, and the
        // parent chain above it has already been checked.
        current = candidate
        continue
      }

      // A real entry: resolve it, so a hard-to-see case (a bind mount, a link
      // the lstat above already collapsed) still gets checked against the root.
      try {
        current = await this.fs.realpath(candidate)
      } catch {
        current = candidate
      }
      if (!inside(current)) {
        return { ok: false, reason: 'path resolves outside the vault' }
      }
    }

    if (!inside(current)) return { ok: false, reason: 'path resolves outside the vault' }
    return { ok: true, absolute: current }
  }

  private absolutise(target: string, parent: string): string {
    const isAbsolute =
      target.startsWith('/') || /^[a-zA-Z]:/.test(target) || target.startsWith('\\\\')
    if (!isAbsolute) return this.normalise(this.fs.join(parent, target))
    return this.normalise(target)
  }

  /** Collapse `.` and `..` textually — the target of a link is not resolvable by stat. */
  private normalise(p: string): string {
    const unified = p.split('\\').join('/')
    const lead = unified.startsWith('/') ? '/' : ''
    const out: string[] = []
    for (const seg of unified.split('/')) {
      if (seg === '' || seg === '.') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    return lead + out.join('/')
  }

  private async require(relative: string): Promise<string> {
    const r = await this.resolve(relative)
    if (!r.ok) throw new Error(`${relative}: ${r.reason}`)
    return r.absolute
  }

  async readNote(relative: string): Promise<LoadedNote> {
    const absolute = await this.require(relative)
    const stat = await this.fs.lstat(absolute)
    if (stat === null) throw new Error(`${relative}: not found`)
    const contents = await this.fs.readFile(absolute)
    return { contents, mtimeMs: stat.mtimeMs }
  }

  /**
   * VAULT-002 + VAULT-003.
   *
   * `expectedMtimeMs` is what the caller believes it loaded — `null` means "I
   * believe this file does not exist". Either belief is checked against disk
   * immediately before writing, never against arithmetic on a remembered value.
   * A vault is edited by text editors, `git checkout` and the student's own
   * `mv`; external change is normal, and silently winning it is data loss.
   */
  async writeNote(
    relative: string,
    contents: string,
    expectedMtimeMs: number | null,
  ): Promise<void> {
    const absolute = await this.require(relative)
    const current = await this.fs.lstat(absolute)

    if (expectedMtimeMs === null) {
      if (current !== null) {
        throw new VaultConflictError(
          relative,
          'expected a new file, but one already exists on disk',
        )
      }
    } else {
      if (current === null) {
        throw new VaultConflictError(
          relative,
          'the file was deleted or moved after it was loaded',
        )
      }
      if (current.mtimeMs !== expectedMtimeMs) {
        throw new VaultConflictError(relative, 'the file changed on disk after it was loaded')
      }
    }

    await this.fs.mkdirp(this.fs.dirname(absolute))
    await this.fs.writeFileAtomic(absolute, contents)
  }

  async rename(from: string, to: string): Promise<void> {
    // Both ends are resolved. A rename is the easiest way to write outside a
    // sandbox, because only the destination has to escape.
    const source = await this.require(from)
    const destination = await this.require(to)
    await this.fs.mkdirp(this.fs.dirname(destination))
    await this.fs.rename(source, destination)
  }

  async list(relative: string): Promise<string[]> {
    const absolute = await this.require(relative)
    const entries = await this.fs.readdir(absolute)
    return entries.map((e) => e.name)
  }
}
