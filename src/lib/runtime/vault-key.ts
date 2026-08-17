import { useRuntime } from './context'

/**
 * The one fact the workspace needs from the runtime: a stable key identifying
 * WHICH vault is open, for device-local layout storage.
 *
 * Exposed as its own hook — inside the composition-root boundary — so screens
 * keep asking capability questions ("which vault am I keying layout to?")
 * instead of `useRuntime()` mode questions, which the boundary test forbids.
 * Returns `null` when there is no vault, which is itself the answer cloud mode
 * gives.
 */
export function useRuntimeVaultKey(): string | null {
  const { state } = useRuntime()
  if (state.status !== 'ready') return null
  return state.runtime.mode === 'local' ? state.runtime.vault.path : null
}
