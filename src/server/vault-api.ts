import { randomBytes } from 'node:crypto'

import { nodeFileSystem } from '../lib/vault/node-fs'
import { VaultRepository } from '../lib/vault/vault-repository'

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
const OPERATIONS = ['readNote', 'writeNote'] as const

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

  async open(path: string): Promise<{ id: string; name: string }> {
    const stat = await nodeFileSystem.lstat(path)
    if (stat === null) throw new Error('vault not found')
    if (stat.kind !== 'dir') throw new Error('not a directory')

    // Resolved once, on the privileged side, and stored resolved — so a symlink
    // swapped in afterwards cannot move the root out from under the repository.
    const real = await nodeFileSystem.realpath(path)
    const id = randomBytes(16).toString('base64url')
    this.byId.set(id, { path: real, repo: new VaultRepository(nodeFileSystem, real) })
    return { id, name: real.split(/[/\\]/).pop() ?? real }
  }

  get(id: string): { path: string; repo: VaultRepository } | null {
    return this.byId.get(id) ?? null
  }

  async exists(path: string): Promise<boolean> {
    const stat = await nodeFileSystem.lstat(path)
    return stat !== null && stat.kind === 'dir'
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
    return json(403, { error: 'origin not allowed' })
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
    return json(401, { error: 'missing or invalid capability' }, allowed ? origin : undefined)
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'method not allowed' }, allowed ? origin : undefined)
  }

  const reply = (status: number, value: unknown) =>
    json(status, value, allowed ? origin : undefined)

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(req.body || '{}') as Record<string, unknown>
  } catch {
    return reply(400, { error: 'invalid JSON' })
  }

  const path = req.url.split('?')[0] ?? ''

  // --- open: the one and only place an absolute path is accepted ------------
  if (path === `${PREFIX}/open`) {
    const target = payload.path
    if (typeof target !== 'string' || target.length === 0) {
      return reply(400, { error: 'path required' })
    }
    try {
      return reply(200, await sessions.open(target))
    } catch (error) {
      return reply(404, { error: (error as Error).message })
    }
  }

  if (path === `${PREFIX}/exists`) {
    const target = payload.path
    if (typeof target !== 'string') return reply(400, { error: 'path required' })
    return reply(200, { exists: await sessions.exists(target) })
  }

  // --- everything else is vault-scoped and relative -------------------------
  const match = /^\/__campus\/vault\/([A-Za-z0-9_-]+)\/op$/.exec(path)
  if (!match) return reply(404, { error: 'unknown endpoint' })

  const session = sessions.get(match[1]!)
  // An unknown id is refused rather than reopened. Reopening from a payload
  // would put vault selection back in the browser's hands.
  if (!session) return reply(404, { error: 'unknown vault' })

  const op = payload.op
  if (typeof op !== 'string' || !OPERATIONS.includes(op as Operation)) {
    return reply(400, { error: 'unsupported operation' })
  }

  const relative = payload.path
  if (typeof relative !== 'string') return reply(400, { error: 'path must be a string' })

  try {
    // Delegated to VaultRepository, the single authority. Nothing here
    // re-derives traversal, symlink or containment rules.
    if (op === 'readNote') {
      return reply(200, { ok: true, value: await session.repo.readNote(relative) })
    }

    const contents = payload.contents
    const expected = payload.expectedMtimeMs
    if (typeof contents !== 'string') return reply(400, { error: 'contents must be a string' })
    if (expected !== null && typeof expected !== 'number') {
      return reply(400, { error: 'expectedMtimeMs must be a number or null' })
    }
    await session.repo.writeNote(relative, contents, expected)
    return reply(200, { ok: true, value: null })
  } catch (error) {
    const message = (error as Error).message

    // A file that is not there yet is the ORDINARY state of a fresh vault, not
    // a protocol error. Reporting it as 400 made every startup log a client
    // error for reading a note nobody has written, which trains everyone to
    // ignore 400s from this endpoint — including the security refusals.
    const notFound = /: not found$/.test(message)

    // Security refusals travel verbatim. Softening "path resolves outside the
    // vault" into a generic I/O error would hide the one message that explains
    // it, and let a caller mistake a refusal for a transient failure.
    return reply(notFound ? 200 : 400, {
      ok: false,
      notFound,
      error: message,
      conflict: (error as Error).name === 'VaultConflictError',
    })
  }
}
