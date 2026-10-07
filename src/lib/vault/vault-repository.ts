import { VaultConflictError, VaultError, type VaultErrorCode } from './errors'
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

/** Linux caps symlink expansion at 40 per lookup (ELOOP); the walk uses the same bound. */
const MAX_LINK_HOPS = 40

export type ResolveResult =
  { ok: true; absolute: string } | { ok: false; reason: string; code: VaultErrorCode }

// Re-exported: the conflict error is part of this module's public surface.
export { VaultConflictError }

/**
 * A file name that is safe to carry into the trash. The sidecar records the
 * original path, so the trashed copy only needs to be recognisable: capping it
 * keeps `.campus/trash/<stamp>-<name>.meta.json` inside the path-length limit
 * however long the student's own file name was.
 */
const TRASH_NAME_MAX = 80
function shortTrashName(name: string): string {
  const chars = [...name]
  if (chars.length <= TRASH_NAME_MAX) return name
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 && name.length - dot <= 12 ? name.slice(dot) : ''
  const stem = chars.slice(0, TRASH_NAME_MAX - [...extension].length).join('')
  // Windows rewrites a trailing dot or space; do not leave one behind.
  return stem.replace(/[. ]+$/, '') + extension
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
   * reaches a syscall. Then walk the path the way the KERNEL will: one
   * component at a time, following every link — including the links a link
   * points at. Judging a link by its target string is not enough, because that
   * target can itself be a link (`a -> b`, `b -> /etc/hostname`): the first hop
   * lands inside the vault and a textual check passes, while the kernel keeps
   * going. So a link's target is spliced into the work queue and walked with
   * the same rules, however many hops it takes.
   *
   * Absent entries are not followed (there is nothing to follow) and are not
   * an error: that is a note or folder being created. A link whose target does
   * not exist is still followed to where the target WOULD be, because the
   * target can be created a second later.
   */
  async resolve(relative: string): Promise<ResolveResult> {
    const verdict = validateVaultPath(relative)
    if (!verdict.ok) return verdict

    let realRoot: string
    try {
      realRoot = await this.fs.realpath(this.root)
    } catch {
      return { ok: false, reason: 'vault root is not readable', code: 'root_unreadable' }
    }

    const inside = (p: string) =>
      p === realRoot || p.startsWith(realRoot + '/') || p.startsWith(realRoot + '\\')
    const outside: ResolveResult = {
      ok: false,
      reason: 'path resolves outside the vault',
      code: 'outside_vault',
    }

    // The physical directory we have walked to, and what is left to walk.
    let current = realRoot
    const pending = [...verdict.segments]
    // The deepest prefix that exists on disk: the part `realpath` can vouch for.
    let deepestExisting = realRoot
    let hops = 0
    let absent = false

    while (pending.length > 0) {
      const segment = pending.shift()!
      if (segment === '' || segment === '.') continue
      if (segment === '..') {
        // `current` is physical, so its textual parent is its real parent.
        current = this.fs.dirname(current)
        continue
      }

      const candidate = this.fs.join(current, segment)
      // Below an absent entry nothing can be a link, so stop asking the disk.
      const stat = absent ? null : await this.fs.lstat(candidate)

      if (stat === null) {
        absent = true
        current = candidate
        continue
      }

      if (stat.kind !== 'symlink') {
        current = candidate
        deepestExisting = candidate
        continue
      }

      hops += 1
      if (hops > MAX_LINK_HOPS)
        return { ok: false, reason: 'too many symbolic links', code: 'too_many_links' }

      let target: string
      try {
        target = await this.fs.readlink(candidate)
      } catch {
        return { ok: false, reason: 'symlink is not readable', code: 'symlink_unreadable' }
      }

      const unified = target.split('\\').join('/')
      if (unified.startsWith('//')) return outside
      const drive = /^[a-zA-Z]:/.exec(unified)
      if (unified.startsWith('/')) {
        current = '/'
      } else if (drive) {
        current = drive[0] + '/'
      }
      // The link's own components go FIRST, so the rest of the requested path
      // is resolved relative to wherever the link really leads.
      const parts = unified.replace(/^([a-zA-Z]:)?\/+/, '').split('/')
      pending.unshift(...parts)
      deepestExisting = current
    }

    if (!inside(current)) return outside

    // Defence in depth: ask the OS about the deepest part that exists. This
    // catches what lstat cannot see (a bind mount, a case-folding quirk).
    try {
      const real = await this.fs.realpath(deepestExisting)
      if (!inside(real)) return outside
    } catch {
      return outside
    }

    return { ok: true, absolute: current }
  }

  private async require(relative: string): Promise<string> {
    const r = await this.resolve(relative)
    // The reason names no path: the caller already knows which path it asked
    // about, and repeating it here is how messages ended up saying it twice.
    if (!r.ok) throw new VaultError(r.code, r.reason)
    return r.absolute
  }

  async readNote(relative: string): Promise<LoadedNote> {
    const absolute = await this.require(relative)
    const stat = await this.fs.lstat(absolute)
    if (stat === null) throw new VaultError('not_found', 'not found')
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
          'already_exists',
        )
      }
    } else {
      if (current === null) {
        throw new VaultConflictError(
          relative,
          'the file was deleted or moved after it was loaded',
          'conflict_missing',
        )
      }
      if (current.mtimeMs !== expectedMtimeMs) {
        throw new VaultConflictError(
          relative,
          'the file changed on disk after it was loaded',
          'conflict_changed',
        )
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

    if ((await this.fs.lstat(source)) === null) throw new VaultError('not_found', 'not found')

    // POSIX rename replaces the destination atomically. For a student that is
    // "renaming a.md onto b.md deleted my b.md" — the filesystem's own default
    // is the data-loss bug, so an existing destination is a CONFLICT the
    // student resolves, never a thing we resolve for them.
    if ((await this.fs.lstat(destination)) !== null) {
      throw new VaultConflictError(to, 'the destination already exists', 'destination_exists')
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
    if ((await this.fs.lstat(absolute)) === null) throw new VaultError('not_found', 'not found')
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
    if (stat === null) throw new VaultError('not_found', 'not found')

    // A unique destination, so two deleted "nota.md" never clobber each other.
    // The suffix is time-based for a human sorting the trash by hand, plus a
    // random tail because two deletes can land on the same millisecond.
    const name = shortTrashName(relative.split(/[\\/]/).filter(Boolean).pop() ?? relative)
    const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const trashedTo = `.campus/trash/${unique}-${name}`

    // Both ends are judged BEFORE anything moves. Resolving the sidecar after
    // the rename meant a path-length refusal there left the note already in the
    // trash, with no record of where it came from.
    const destination = await this.require(trashedTo)
    const meta = await this.require(trashedTo + '.meta.json')
    await this.fs.mkdirp(this.fs.dirname(destination))
    await this.fs.rename(source, destination)

    // The sidecar is what makes restore possible: the trash entry knows where
    // it came from, in plain JSON any file manager can read.
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
