import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react'

import { BackendProvider } from '@/lib/backends/context'
import { FilesProvider } from '@/lib/files/context'

import { RequiresAccountProvider } from './identity'

import {
  forgetVault,
  readDeviceConfig,
  rememberCloud,
  rememberVault,
  writeDeviceConfig,
} from './device-config'
import { descriptorFor, resolveCampusRuntime, type RuntimeCapabilities } from './resolve'
import type { StartupState, VaultDescriptor } from './types'

/**
 * LOCAL-004 — the composition root.
 *
 *     RuntimeProvider  ← the only place that knows which world we are in
 *         ↓ CampusRuntime
 *     BackendProvider
 *         ↓ CampusBackend
 *     TanStack Query · components
 *
 * Everything below `BackendProvider` receives one interface and cannot tell
 * whether it is talking to a folder or to Postgres. That is the entire point:
 * the two modes reach the SAME component tree.
 */

interface RuntimeValue {
  state: StartupState
  /** Choose a vault. Records it as most-recent and opens it. */
  chooseVault(vault: VaultDescriptor): Promise<void>
  /** Choose Campus Cloud. An explicit choice, never an error fallback. */
  chooseCloud(): Promise<void>
  /** Drop a vault we can no longer find. Removes the ENTRY, never the folder. */
  forget(path: string): void
  /** Recent vaults on THIS device. */
  recent(): VaultDescriptor[]
}

const RuntimeContext = createContext<RuntimeValue | null>(null)

export function RuntimeProvider({
  children,
  capabilities,
  /** What to show while startup has not answered, and when it answers "nothing". */
  fallback,
}: {
  children: ReactNode
  capabilities: RuntimeCapabilities
  fallback: (value: RuntimeValue) => ReactNode
}) {
  // `resolving` is the honest initial value. Starting at `needs-choice` would
  // flash the picker at a student whose vault was about to open.
  const [state, setState] = useState<StartupState>({ status: 'resolving' })

  useEffect(() => {
    let cancelled = false
    // The `catch` is not defensive noise: without it, a rejection anywhere in
    // the resolve path skips `setState` entirely and startup stays on its
    // loading indicator forever — no message, no retry, nothing to click. A
    // loading screen must never be a destination, so an unexpected failure
    // becomes the picker, which is at least somewhere the student can act.
    void Promise.resolve()
      .then(() => resolveCampusRuntime(capabilities))
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'needs-choice' })
      })
    return () => {
      cancelled = true
    }
  }, [capabilities])

  const chooseVault = useCallback(
    async (vault: VaultDescriptor) => {
      const runtime = await capabilities.openLocal(vault)
      // Recorded only AFTER the vault opened. Remembering first would leave a
      // broken path in the recent list for a vault that never worked.
      writeDeviceConfig(
        capabilities.store,
        rememberVault(readDeviceConfig(capabilities.store), vault),
      )
      setState({ status: 'ready', runtime })
    },
    [capabilities],
  )

  const chooseCloud = useCallback(async () => {
    const runtime = await capabilities.openCloud()
    writeDeviceConfig(capabilities.store, rememberCloud(readDeviceConfig(capabilities.store)))
    setState({ status: 'ready', runtime })
  }, [capabilities])

  const forget = useCallback(
    (path: string) => {
      writeDeviceConfig(
        capabilities.store,
        forgetVault(readDeviceConfig(capabilities.store), path),
      )
      setState({ status: 'needs-choice' })
    },
    [capabilities],
  )

  const recent = useCallback(
    () => readDeviceConfig(capabilities.store).recentVaults,
    [capabilities],
  )

  const value: RuntimeValue = { state, chooseVault, chooseCloud, forget, recent }

  if (state.status !== 'ready') {
    return <RuntimeContext value={value}>{fallback(value)}</RuntimeContext>
  }

  return (
    <RuntimeContext value={value}>
      {/* The only fact about the runtime that reaches routes, and it is a
          capability rather than an identity: LOCAL needs no account. */}
      <RequiresAccountProvider value={state.runtime.mode === 'cloud'}>
        <BackendProvider backend={state.runtime.backend}>
          {/* Files are a capability, not a mode: cloud simply has none, and
              every file surface renders its no-vault state from that null. */}
          <FilesProvider access={state.runtime.mode === 'local' ? state.runtime.access : null}>
            {children}
          </FilesProvider>
        </BackendProvider>
      </RequiresAccountProvider>
    </RuntimeContext>
  )
}

/**
 * The runtime, for the picker and for diagnostics.
 *
 * Screens do NOT call this to branch on `mode` — they call `useBackend()`. This
 * exists for the startup surface, which is the one place that legitimately has
 * to talk about local and cloud as choices.
 */
export function useRuntime(): RuntimeValue {
  const value = use(RuntimeContext)
  if (!value) throw new Error('useRuntime debe usarse dentro de <RuntimeProvider>')
  return value
}

export { descriptorFor }
