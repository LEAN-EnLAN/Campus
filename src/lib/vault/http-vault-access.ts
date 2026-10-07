import type {
  LoadedNote,
  TrashedEntry,
  VaultAccess,
  VaultEntry,
  VaultStat,
} from './vault-access'
import { isVaultErrorCode, VaultConflictError, VaultError, type VaultErrorCode } from './errors'

/**
 * The browser's `VaultAccess`. A thin client, and deliberately nothing more.
 *
 *     LocalBackend → VaultAccess → this → HTTP → VaultRepository → disk
 *
 * What is absent here is the design. There is no path resolution, no
 * containment check, no symlink handling — not because they were forgotten but
 * because doing them here would be theatre. A compromised page skips
 * client-side checks entirely, so the only checks that matter are the ones on
 * the privileged side, and duplicating them would create a second boundary that
 * eventually disagrees with the first about which paths are legal.
 *
 * This object cannot name an absolute path. It does not know one: the vault was
 * chosen once, server-side, and it holds only an opaque id.
 */

export interface VaultTransport {
  /** Opaque id from `open`. Says nothing about the student's home directory. */
  vaultId: string
  /** Per-process capability. Without it the API refuses before parsing. */
  token: string
  baseUrl: string
}

/**
 * POST to the Vault API and read a JSON answer.
 *
 * Anything that is not the Vault API answering — a network failure, or a static
 * host replying with an HTML 404/405 — is `unavailable`, reported as such. The
 * old `response.json()` surfaced it as `Unexpected token '<'`, which says
 * nothing a student can act on.
 */
async function post<T extends { httpOk?: boolean }>(
  url: string,
  token: string,
  payload: unknown,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-campus-capability': token },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new VaultError('unavailable', 'the Vault API could not be reached')
  }
  try {
    const body = (await response.json()) as T | null
    if (typeof body !== 'object' || body === null) throw new Error('not an object')
    return Object.assign(body, { httpOk: response.ok })
  } catch {
    throw new VaultError('unavailable', `the Vault API sent no JSON (${response.status})`)
  }
}

interface Failure {
  ok?: boolean
  code?: string
  error?: string
  conflict?: boolean
  httpOk?: boolean
}

/** A stable code from whatever the server sent; `unknown` for an older server that sent none. */
const codeOf = (body: Failure): VaultErrorCode =>
  isVaultErrorCode(body.code) ? body.code : 'unknown'

async function call(
  transport: VaultTransport,
  op: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const body = await post<Failure & { value?: unknown }>(
    `${transport.baseUrl}/__campus/vault/${transport.vaultId}/op`,
    transport.token,
    { op, ...payload },
  )

  if (!body.httpOk || body.ok === false) {
    const detail = body.error ?? `vault ${op} failed`
    // A conflict is not an I/O failure: it means the student has two versions
    // of their own work. Flattening it into a generic Error here would lose the
    // one distinction VAULT-003 exists to preserve, and callers that catch
    // `VaultConflictError` would silently stop working over HTTP.
    if (body.conflict) {
      const code = codeOf(body)
      throw new VaultConflictError(
        String(payload.path ?? ''),
        detail,
        code === 'already_exists' ||
          code === 'destination_exists' ||
          code === 'conflict_missing'
          ? code
          : 'conflict_changed',
      )
    }
    throw new VaultError(codeOf(body), detail)
  }
  return body.value
}

export function httpVaultAccess(transport: VaultTransport): VaultAccess {
  return {
    readNote: (relative) =>
      call(transport, 'readNote', { path: relative }) as Promise<LoadedNote>,
    writeNote: async (relative, contents, expectedMtimeMs) => {
      await call(transport, 'writeNote', { path: relative, contents, expectedMtimeMs })
    },
    listDir: (relative) =>
      call(transport, 'listDir', { path: relative }) as Promise<VaultEntry[]>,
    mkdir: async (relative) => {
      await call(transport, 'mkdir', { path: relative })
    },
    rename: async (from, to) => {
      await call(transport, 'rename', { path: from, to })
    },
    trash: (relative) => call(transport, 'trash', { path: relative }) as Promise<TrashedEntry>,
    stat: (relative) =>
      call(transport, 'stat', { path: relative }) as Promise<VaultStat | null>,
  }
}

/** Ask the API to open a folder. The one call that names an absolute path. */
export async function openVaultSession(
  baseUrl: string,
  token: string,
  path: string,
): Promise<{ id: string; name: string }> {
  const payload = await post<Failure & { id?: string; name?: string }>(
    `${baseUrl}/__campus/vault/open`,
    token,
    { path },
  )
  if (!payload.httpOk || !payload.id) {
    throw new VaultError(codeOf(payload), payload.error ?? 'the vault could not be opened')
  }
  return { id: payload.id, name: payload.name ?? path }
}

export async function vaultExists(
  baseUrl: string,
  token: string,
  path: string,
): Promise<boolean> {
  const payload = await post<{ exists?: boolean; httpOk?: boolean }>(
    `${baseUrl}/__campus/vault/exists`,
    token,
    { path },
  ).catch(() => null)
  return payload?.httpOk === true && payload.exists === true
}
