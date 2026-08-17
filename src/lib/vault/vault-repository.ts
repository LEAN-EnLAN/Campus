import type { FileSystemPort } from './fs-port'
import { validateVaultPath } from './path-resolver'
import type {
  LoadedNote,
  TrashedEntry,
  VaultAccess,
  VaultEntry,
  VaultStat,
} from './vault-access'

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

export class VaultRepository implements VaultAccess {
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

    // POSIX rename replaces the destination atomically. For a student that is
    // "renaming a.md onto b.md deleted my b.md" — the filesystem's own default
    // is the data-loss bug, so an existing destination is a CONFLICT the
    // student resolves, never a thing we resolve for them.
    if ((await this.fs.lstat(destination)) !== null) {
      throw new VaultConflictError(to, 'ya existe un archivo con ese nombre')
    }

    await this.fs.mkdirp(this.fs.dirname(destination))
    await this.fs.rename(source, destination)
  }

  async list(relative: string): Promise<string[]> {
    const absolute = await this.require(relative)
    const entries = await this.fs.readdir(absolute)
    return entries.map((e) => e.name)
  }

  async listDir(relative: string): Promise<VaultEntry[]> {
    // '' means the vault root, which validateVaultPath refuses as empty — the
    // root is the one path that needs no per-segment judgement.
    const absolute =
      relative === '' ? await this.fs.realpath(this.root) : await this.require(relative)
    const raw = await this.fs.readdir(absolute)

    const out: VaultEntry[] = []
    for (const entry of raw) {
      // .campus is Campus's own state (trash, index, academic JSON). The
      // explorer shows the student THEIR vault; hiding it here rather than in
      // the UI means no surface can forget to.
      if (relative === '' && entry.name === '.campus') continue
      if (entry.kind !== 'file' && entry.kind !== 'dir') continue
      const stat = await this.fs.lstat(this.fs.join(absolute, entry.name))
      if (stat === null) continue
      out.push({ name: entry.name, kind: entry.kind, mtimeMs: stat.mtimeMs, size: stat.size })
    }
    return out.sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name, 'es') : a.kind === 'dir' ? -1 : 1,
    )
  }

  async mkdir(relative: string): Promise<void> {
    const absolute = await this.require(relative)
    await this.fs.mkdirp(absolute)
  }

  async trash(relative: string): Promise<TrashedEntry> {
    const source = await this.require(relative)
    const stat = await this.fs.lstat(source)
    if (stat === null) throw new Error(`${relative}: not found`)

    // A unique destination, so two deleted "nota.md" never clobber each other.
    // The suffix is time-based for a human sorting the trash by hand, plus a
    // random tail because two deletes can land on the same millisecond.
    const name = relative.split('/').pop() ?? relative
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const trashedTo = `.campus/trash/${unique}-${name}`

    const destination = await this.require(trashedTo)
    await this.fs.mkdirp(this.fs.dirname(destination))
    await this.fs.rename(source, destination)

    // The sidecar is what makes restore possible: the trash entry knows where
    // it came from, in plain JSON any file manager can read.
    const meta = await this.require(trashedTo + '.meta.json')
    await this.fs.writeFileAtomic(
      meta,
      JSON.stringify({ originalPath: relative, trashedAt: new Date().toISOString() }, null, 2) +
        '\n',
    )
    return { trashedTo }
  }

  async stat(relative: string): Promise<VaultStat | null> {
    const absolute = await this.require(relative)
    const stat = await this.fs.lstat(absolute)
    if (stat === null || (stat.kind !== 'file' && stat.kind !== 'dir')) return null
    return { kind: stat.kind, mtimeMs: stat.mtimeMs, size: stat.size }
  }
}
