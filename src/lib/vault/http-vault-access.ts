import type {
  LoadedNote,
  TrashedEntry,
  VaultAccess,
  VaultEntry,
  VaultStat,
} from './vault-access'
import { VaultConflictError } from './vault-repository'

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

async function call(
  transport: VaultTransport,
  op: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${transport.baseUrl}/__campus/vault/${transport.vaultId}/op`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-campus-capability': transport.token },
    body: JSON.stringify({ op, ...payload }),
  })

  const body = (await response.json()) as {
    ok?: boolean
    value?: unknown
    error?: string
    conflict?: boolean
    notFound?: boolean
  }

  if (!response.ok || body.ok === false) {
    const message = body.error ?? `vault ${op} failed (${response.status})`
    // A conflict is not an I/O failure: it means the student has two versions
    // of their own work. Flattening it into a generic Error here would lose the
    // one distinction VAULT-003 exists to preserve, and callers that catch
    // `VaultConflictError` would silently stop working over HTTP.
    if (body.conflict) throw new VaultConflictError(String(payload.path ?? ''), message)
    throw new Error(message)
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
  const response = await fetch(`${baseUrl}/__campus/vault/open`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-campus-capability': token },
    body: JSON.stringify({ path }),
  })
  const payload = (await response.json()) as { id?: string; name?: string; error?: string }
  if (!response.ok || !payload.id) throw new Error(payload.error ?? 'no pudimos abrir el vault')
  return { id: payload.id, name: payload.name ?? path }
}

export async function vaultExists(
  baseUrl: string,
  token: string,
  path: string,
): Promise<boolean> {
  const response = await fetch(`${baseUrl}/__campus/vault/exists`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-campus-capability': token },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) return false
  return ((await response.json()) as { exists?: boolean }).exists === true
}
