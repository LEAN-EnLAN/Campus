import { createContext, use, type ReactNode } from 'react'

import type {
  LoadedNote,
  TrashedEntry,
  VaultAccess,
  VaultEntry,
  VaultStat,
} from '@/lib/vault/vault-access'

/**
 * The files capability, as presentation is allowed to see it.
 *
 * Screens may not import `@/lib/vault` — that boundary is a test, not a
 * convention (`tests/unit/runtime-boundary.test.ts`). But the workspace is
 * ABOUT files, so it needs a seam: this module re-exports the vault types under
 * a capability the composition root wires once.
 *
 *     RuntimeProvider (local mode) ──► FilesProvider(access)
 *     RuntimeProvider (cloud mode) ──► FilesProvider(null)
 *
 * `null` is a real answer: CLOUD mode has no vault, and every file surface must
 * render its "solo con un Vault local" state rather than crash or hide.
 */

export type { LoadedNote, TrashedEntry, VaultEntry, VaultStat }
export type FilesAccess = VaultAccess

const FilesContext = createContext<FilesAccess | null>(null)

export function FilesProvider({
  access,
  children,
}: {
  access: FilesAccess | null
  children: ReactNode
}) {
  return <FilesContext value={access}>{children}</FilesContext>
}

/** The capability, or `null` when the runtime has no vault (cloud mode). */
export function useFiles(): FilesAccess | null {
  return use(FilesContext)
}
