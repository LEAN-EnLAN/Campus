import { supabase, supabaseConfigured } from '@/lib/supabase'
import { loadPortableCatalog, type PortableCatalog } from '@/lib/backends/local/catalog'
import { LocalBackend } from '@/lib/backends/local/local-backend'
import { createSupabaseBackend } from '@/lib/backends/supabase-backend'
import { isVaultAvailable, type BuildEnv } from '@/lib/runtime/build-flags'
import { browserDeviceStore } from '@/lib/runtime/device-config'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import { seedDemo } from '@/lib/demo/seed'
import { clearDemoSession, demoRequested, markDemoSession } from '@/lib/demo/session'
import { VaultError } from '@/lib/vault/errors'
import { memoryVaultAccess } from '@/lib/vault/memory-vault-access'
import {
  httpVaultAccess,
  listVaultFolders,
  openVaultSession,
  vaultExists,
} from '@/lib/vault/http-vault-access'

import { fetchCatalogFile } from './catalog-fetch'

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
    readFile: (path) => fetchCatalogFile(path),
    readDir: async () => {
      // The bundled catalog ships a manifest rather than a directory listing:
      // a browser cannot list a directory, and inventing an endpoint that could
      // would be a filesystem API by another name.
      return JSON.parse(await fetchCatalogFile('/academic-catalog/curricula.json')) as string[]
    },
  })
  return catalogPromise
}

export function resolveRuntimeCapabilities(
  env: BuildEnv = import.meta.env,
): RuntimeCapabilities {
  const baseUrl = window.location.origin
  const token = window.__CAMPUS_VAULT_TOKEN__ ?? ''

  return {
    // The one place the build flag is read; everything else is told.
    vaultAvailable: isVaultAvailable(env),

    store: browserDeviceStore(),

    vaultExists: async (path) => {
      if (await vaultExists(baseUrl, token, path)) return true
      // `exists` answers false for a folder that is gone and for one outside the
      // allowed roots alike (it must not be an oracle for the disk). Telling a
      // student "it moved" about a folder that is merely not allowed sends them
      // hunting for the wrong problem, so ask `open`: its refusal carries the
      // code, and only a plain "not found" stays a missing vault.
      try {
        await openVaultSession(baseUrl, token, path)
        return true
      } catch (cause) {
        if (cause instanceof VaultError && cause.code !== 'folder_not_found') throw cause
        return false
      }
    },

    listFolders: (path) => listVaultFolders(baseUrl, token, path),

    openLocal: async (vault, options) => {
      const session = await openVaultSession(baseUrl, token, vault.path, options)
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

    openCloud: async () => {
      // A build without the cloud's values can still run the demo; it must not
      // then pretend it can open the cloud.
      if (!supabaseConfigured)
        throw new Error('Esta versión de Campus no tiene la nube configurada.')
      return { mode: 'cloud', backend: createSupabaseBackend() }
    },

    openCopyFolder: async (path) => {
      const session = await openVaultSession(baseUrl, token, path, { create: true })
      return httpVaultAccess({ vaultId: session.id, token, baseUrl })
    },

    demoRequested: demoRequested(),

    openDemo: async () => {
      // The SAME LocalBackend a folder gets, over files that live in this tab.
      const access = memoryVaultAccess()
      const backend = new LocalBackend(access, await catalog())
      await seedDemo(backend)
      markDemoSession()
      return { mode: 'demo', backend, access }
    },

    closeDemo: clearDemoSession,

    leaveDemo: () => {
      clearDemoSession()
      // A full load, not a route change: the in-memory demo must not survive
      // into whatever this device opens next.
      window.location.assign('/')
    },
  }
}
