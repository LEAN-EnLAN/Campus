import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

import { VaultConflictError, VaultError, vaultErrorFromSystem } from '../lib/vault/errors'
import type { VaultErrorCode } from '../lib/vault/errors'
import { nodeFileSystem } from '../lib/vault/node-fs'
import { VaultRepository } from '../lib/vault/vault-repository'
import { isInsideAny } from './vault-roots'

/**
 * The local Vault API.
 *
 *     Browser → fetch → this handler → VaultRepository → NodeFileSystem → disk
 *
 * Framework-agnostic on purpose. The Vite plugin merely MOUNTS it during
 * development; `campus serve` (Milestone D) mounts the same handler. A transport
 * that only exists as a Vite plugin becomes the production architecture by
 * accident, and then gets rebuilt under deadline — which is exactly when a
 * security boundary gets simplified.
 *
 * Three rules shape everything below.
 *
 * 1. The wire surface is `VaultAccess`, not a filesystem. Two operations, both
 *    semantic, both inside an already-chosen vault. There is no realpath, no
 *    stat-an-absolute-path, no readdir, no exec — not because they are guarded,
 *    but because they are absent.
 *
 * 2. The browser names an absolute path exactly once, at `open`, and receives an
 *    opaque id. Every later request is vault-relative.
 *
 * 3. Path safety is NOT reimplemented here. Every relative path goes through
 *    `VaultRepository`, which is the single authority. A transport that
 *    re-derived the rules would be a SECOND boundary, and two boundaries drift
 *    until one of them is wrong.
 */

/** Exactly `VaultAccess`. Adding to this list is adding to the attack surface. */
const OPERATIONS = [
  'readNote',
  'writeNote',
  'listDir',
  'mkdir',
  'rename',
  'trash',
  'stat',
] as const

type Operation = (typeof OPERATIONS)[number]

export interface VaultRequest {
  method: string
  /** Path and query only, e.g. `/__campus/vault/abc/op`. */
  url: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

export interface VaultResponse {
  status: number
  headers: Record<string, string>
  body: string
}

export interface VaultApiOptions {
  /**
   * Origins allowed to talk to this API. Never `*`.
   *
   * This endpoint reads and writes the student's files, so a page in any tab
   * must not reach it merely because it is listening on loopback.
   */
  allowedOrigins: string[]
  /** Per-process capability. Anything without it is refused before it is parsed. */
  token: string
}

export const PREFIX = '/__campus/vault'

/** A fresh capability, minted once per process and never persisted. */
export function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

const json = (status: number, value: unknown, origin?: string): VaultResponse => ({
  status,
  headers: {
    'content-type': 'application/json',
    // Closed by construction: echoed only for an origin already on the
    // allowlist, never `*`, and credentials are never enabled.
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    'cache-control': 'no-store',
  },
  body: JSON.stringify(value),
})

/** A refusal in the one shape every failure uses: a code, plus English for logs. */
const refusal = (
  status: number,
  code: VaultErrorCode,
  message: string,
  origin?: string,
): VaultResponse => json(status, { ok: false, code, error: message }, origin)

const header = (req: VaultRequest, name: string): string | null => {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()]
  return typeof value === 'string' ? value : null
}

/**
 * Open vaults, by opaque id.
 *
 * The id keeps absolute paths out of every request after the first. It is
 * random rather than derived from the path, so it leaks nothing about the
 * student's home directory to a page that manages to observe one.
 */
export class VaultSessions {
  private readonly byId = new Map<string, { path: string; repo: VaultRepository }>()
  /** The folders `open` may land in. Absolute and normalised; never empty by accident. */
  readonly allowedRoots: readonly string[]

  constructor(options: { allowedRoots?: readonly string[] } = {}) {
    this.allowedRoots = (options.allowedRoots ?? [homedir()]).map((root) => resolve(root))
  }

  /**
   * Decide whether `path` may become a Vault, and where it really is.
   *
   * Judged TWICE, deliberately. First on the string the page sent: a path
   * outside the roots is refused as `folder_outside_roots` WITHOUT touching the
   * disk, so existing and missing folders look identical from outside (no
   * existence oracle). Then on the real path: a link inside the home that points
   * out of it is refused too, which is the other half of "refuses symlinks that
   * escape" — the roots themselves are resolved first, because `/home` may
   * itself be a link.
   */
  private async admit(path: string): Promise<string> {
    if (!isAbsolute(path)) throw new VaultError('folder_not_absolute', 'path is not absolute')

    const realRoots = await this.realRoots()
    const textual = [...this.allowedRoots, ...realRoots]
    if (!isInsideAny(textual, path)) {
      throw new VaultError('folder_outside_roots', 'folder is outside the allowed roots')
    }

    let real: string
    try {
      const stat = await nodeFileSystem.lstat(path)
      if (stat === null) throw new VaultError('folder_not_found', 'vault not found')
      real = await nodeFileSystem.realpath(path)
    } catch (error) {
      if (error instanceof VaultError) throw error
      const failure = vaultErrorFromSystem(error)
      throw new VaultError(
        failure.code === 'not_found' ? 'folder_not_found' : failure.code,
        failure.message,
      )
    }
    if (!isInsideAny(realRoots, real)) {
      throw new VaultError('folder_outside_roots', 'folder is outside the allowed roots')
    }

    const stat = await nodeFileSystem.lstat(real)
    if (stat === null) throw new VaultError('folder_not_found', 'vault not found')
    if (stat.kind !== 'dir') throw new VaultError('folder_not_directory', 'not a directory')
    return real
  }

  /** Allowed roots that exist, resolved. A root that is not there allows nothing. */
  private async realRoots(): Promise<string[]> {
    const out: string[] = []
    for (const root of this.allowedRoots) {
      try {
        out.push(await nodeFileSystem.realpath(root))
      } catch {
        // Not there (yet): nothing can be inside it.
      }
    }
    return out
  }

  async open(path: string): Promise<{ id: string; name: string }> {
    // Resolved once, on the privileged side, and stored resolved — so a symlink
    // swapped in afterwards cannot move the root out from under the repository.
    const real = await this.admit(path)
    const id = randomBytes(16).toString('base64url')
    this.byId.set(id, { path: real, repo: new VaultRepository(nodeFileSystem, real) })
    return { id, name: real.split(/[/\\]/).pop() ?? real }
  }

  get(id: string): { path: string; repo: VaultRepository } | null {
    return this.byId.get(id) ?? null
  }

  /** True only for a folder that `open` would accept. Everything else — outside the roots, missing, a file — is the same `false`. */
  async exists(path: string): Promise<boolean> {
    try {
      await this.admit(path)
      return true
    } catch {
      return false
    }
  }
}

/**
 * Handle one request.
 *
 * Refusals are ordered most-hostile-first: a request from the wrong origin or
 * without the capability is rejected before its body is parsed, so a caller who
 * should not be here learns nothing about what is here.
 */
export async function handleVaultRequest(
  req: VaultRequest,
  sessions: VaultSessions,
  options: VaultApiOptions,
): Promise<VaultResponse> {
  const origin = header(req, 'origin')
  const allowed = origin !== null && options.allowedOrigins.includes(origin)

  // A same-origin fetch sends no Origin header on some requests, so absence is
  // permitted; a PRESENT and unlisted origin is not.
  if (origin !== null && !allowed) {
    return refusal(403, 'origin_not_allowed', 'origin not allowed')
  }

  if (req.method === 'OPTIONS') {
    return {
      status: 204,
      headers: {
        ...(allowed ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
        'access-control-allow-methods': 'POST',
        'access-control-allow-headers': 'content-type, x-campus-capability',
        'access-control-max-age': '600',
      },
      body: '',
    }
  }

  if (header(req, 'x-campus-capability') !== options.token) {
    return refusal(
      401,
      'unauthorized',
      'missing or invalid capability',
      allowed ? origin : undefined,
    )
  }

  if (req.method !== 'POST') {
    return refusal(405, 'bad_request', 'method not allowed', allowed ? origin : undefined)
  }

  const reply = (status: number, value: unknown) =>
    json(status, value, allowed ? origin : undefined)

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(req.body || '{}') as Record<string, unknown>
  } catch {
    return reply(400, { ok: false, code: 'bad_request', error: 'invalid JSON' })
  }

  const path = req.url.split('?')[0] ?? ''

  // --- open: the one and only place an absolute path is accepted ------------
  if (path === `${PREFIX}/open`) {
    const target = payload.path
    if (typeof target !== 'string' || target.length === 0) {
      return reply(400, { ok: false, code: 'bad_request', error: 'path required' })
    }
    try {
      return reply(200, await sessions.open(target))
    } catch (error) {
      const failure = vaultErrorFromSystem(error)
      const status =
        failure.code === 'folder_outside_roots' || failure.code === 'permission_denied'
          ? 403
          : failure.code === 'folder_not_absolute'
            ? 400
            : 404
      return reply(status, { ok: false, code: failure.code, error: failure.message })
    }
  }

  if (path === `${PREFIX}/exists`) {
    const target = payload.path
    if (typeof target !== 'string') {
      return reply(400, { ok: false, code: 'bad_request', error: 'path required' })
    }
    return reply(200, { exists: await sessions.exists(target) })
  }

  // --- everything else is vault-scoped and relative -------------------------
  const match = /^\/__campus\/vault\/([A-Za-z0-9_-]+)\/op$/.exec(path)
  if (!match) return reply(404, { ok: false, code: 'bad_request', error: 'unknown endpoint' })

  const session = sessions.get(match[1]!)
  // An unknown id is refused rather than reopened. Reopening from a payload
  // would put vault selection back in the browser's hands.
  if (!session) return reply(404, { ok: false, code: 'unknown_vault', error: 'unknown vault' })

  const op = payload.op
  if (typeof op !== 'string' || !OPERATIONS.includes(op as Operation)) {
    return reply(400, { ok: false, code: 'bad_request', error: 'unsupported operation' })
  }

  const relative = payload.path
  if (typeof relative !== 'string') {
    return reply(400, { ok: false, code: 'bad_request', error: 'path must be a string' })
  }

  try {
    // Delegated to VaultRepository, the single authority. Nothing here
    // re-derives traversal, symlink or containment rules.
    switch (op as Operation) {
      case 'readNote':
        return reply(200, { ok: true, value: await session.repo.readNote(relative) })
      case 'writeNote': {
        const contents = payload.contents
        const expected = payload.expectedMtimeMs
        if (typeof contents !== 'string') {
          return reply(400, {
            ok: false,
            code: 'bad_request',
            error: 'contents must be a string',
          })
        }
        if (expected !== null && typeof expected !== 'number') {
          return reply(400, {
            ok: false,
            code: 'bad_request',
            error: 'expectedMtimeMs must be a number or null',
          })
        }
        await session.repo.writeNote(relative, contents, expected)
        return reply(200, { ok: true, value: null })
      }
      case 'listDir':
        return reply(200, { ok: true, value: await session.repo.listDir(relative) })
      case 'mkdir':
        await session.repo.mkdir(relative)
        return reply(200, { ok: true, value: null })
      case 'rename': {
        const to = payload.to
        if (typeof to !== 'string') {
          return reply(400, { ok: false, code: 'bad_request', error: 'to must be a string' })
        }
        await session.repo.rename(relative, to)
        return reply(200, { ok: true, value: null })
      }
      case 'trash':
        return reply(200, { ok: true, value: await session.repo.trash(relative) })
      case 'stat':
        return reply(200, { ok: true, value: await session.repo.stat(relative) })
    }
  } catch (error) {
    // Everything that leaves here is a CODE plus a path-free English line. A
    // raw `fs` error is never forwarded: its message carries the absolute host
    // path (`ENOENT … rename '/home/…'`), which the page has no business seeing.
    const failure = vaultErrorFromSystem(error)

    // A file that is not there yet is the ORDINARY state of a fresh vault, not
    // a protocol error. Reporting it as 400 made every startup log a client
    // error for reading a note nobody has written, which trains everyone to
    // ignore 400s from this endpoint — including the security refusals.
    const notFound = failure.code === 'not_found'

    // Security refusals keep their own code. Softening `outside_vault` into a
    // generic I/O error would hide the one thing that explains it, and let a
    // caller mistake a refusal for a transient failure.
    return reply(notFound ? 200 : 400, {
      ok: false,
      notFound,
      code: failure.code,
      // A conflict's detail already says what happened; the path is not part
      // of it, because the caller knows which path it asked about.
      error: failure instanceof VaultConflictError ? failure.detail : failure.message,
      conflict: failure instanceof VaultConflictError,
    })
  }
}
