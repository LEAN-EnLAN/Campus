import { supabase } from '@/lib/supabase'
import { loadPortableCatalog, type PortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import { browserDeviceStore } from '@/lib/runtime/device-config'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import { httpVaultAccess, openVaultSession, vaultExists } from '@/lib/vault/http-vault-access'

/**
 * Everything the composition root needs to resolve a runtime, assembled here.
 *
 * `main.tsx` asks for this and nothing else. If it started assembling a
 * `LocalBackend` from a vault, a repository and a catalog itself, the knowledge
 * of how a local runtime is built would live in the entry point — and the next
 * place that needs one would copy it.
 */

declare global {
  interface Window {
    /** Injected by the dev plugin. Per process, never persisted. */
    __CAMPUS_VAULT_TOKEN__?: string
  }
}

/** The catalog is read once per session: it is immutable reference data. */
let catalogPromise: Promise<PortableCatalog> | null = null

function catalog(): Promise<PortableCatalog> {
  catalogPromise ??= loadPortableCatalog('/academic-catalog', {
    readFile: async (path) => {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`no pudimos cargar el catálogo (${response.status})`)
      return response.text()
    },
    readDir: async () => {
      // The bundled catalog ships a manifest rather than a directory listing:
      // a browser cannot list a directory, and inventing an endpoint that could
      // would be a filesystem API by another name.
      const response = await fetch('/academic-catalog/curricula.json')
      if (!response.ok) throw new Error('no pudimos cargar el índice del catálogo')
      return (await response.json()) as string[]
    },
  })
  return catalogPromise
}

export function resolveRuntimeCapabilities(): RuntimeCapabilities {
  const baseUrl = window.location.origin
  const token = window.__CAMPUS_VAULT_TOKEN__ ?? ''

  return {
    store: browserDeviceStore(),

    vaultExists: (path) => vaultExists(baseUrl, token, path),

    openLocal: async (vault) => {
      const session = await openVaultSession(baseUrl, token, vault.path)
      // The chain, assembled in one place and in one direction:
      //   HttpVaultAccess → HTTP → VaultRepository → NodeFileSystem
      // There is NO repository on this side. Client-side path checks are
      // theatre — a compromised page skips them — so the only authority is the
      // one behind the wire, and duplicating it would create a second boundary
      // that eventually disagrees with the first.
      const access = httpVaultAccess({ vaultId: session.id, token, baseUrl })
      return {
        mode: 'local',
        vault: { ...vault, name: session.name },
        backend: new LocalBackend(access, await catalog()),
        // The SAME instance the backend uses: one session, one capability.
        access,
      }
    },

    cloudSession: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session !== null
    },

    openCloud: async () => ({ mode: 'cloud', backend: createSupabaseBackend() }),
  }
}
