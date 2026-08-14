import { createContext, use, useMemo, type ReactNode } from 'react'

import { createSupabaseBackend } from './supabase-backend'
import type { CampusBackend } from './types'

/**
 * The backend is chosen once, here, and nowhere else.
 *
 * Components and hooks call `useBackend()` and never learn whether the answer
 * came from a folder or from Postgres. A `if (mode === 'local')` inside a screen
 * means this boundary is in the wrong place — see
 * `docs/adr/ADR-local-first-backend.md`.
 */
const BackendContext = createContext<CampusBackend | null>(null)

export function BackendProvider({
  children,
  backend,
}: {
  children: ReactNode
  /** Injected in tests and by the local runtime. Defaults to the cloud backend. */
  backend?: CampusBackend
}) {
  // The default is built lazily so importing this module never constructs a
  // Supabase client — which matters for LOCAL mode and for unit tests.
  const value = useMemo(() => backend ?? createSupabaseBackend(), [backend])

  return <BackendContext value={value}>{children}</BackendContext>
}

export function useBackend(): CampusBackend {
  const backend = use(BackendContext)
  if (!backend) throw new Error('useBackend debe usarse dentro de <BackendProvider>')
  return backend
}
