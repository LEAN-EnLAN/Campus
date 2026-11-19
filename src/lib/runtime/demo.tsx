import { useRuntime } from './context'

/**
 * The demo, as a capability. Like `useRuntimeVaultKey`, this lives inside the
 * composition-root boundary so the banner and the `/demo` route never learn
 * the runtime's mode: they ask "am I in the demo?" and get actions back.
 */
export interface DemoValue {
  /** True while the demo workspace is open. */
  active: boolean
  /** Open the demo in place. */
  start(): Promise<void>
  /** Leave the demo and start again at `/`. */
  leave(): void
  /** Leave the demo for Campus Cloud, to create an account. */
  toCloud(): Promise<void>
}

export function useDemo(): DemoValue {
  const runtime = useRuntime()
  return {
    active: runtime.state.status === 'ready' && runtime.state.runtime.mode === 'demo',
    start: runtime.startDemo,
    leave: runtime.leaveDemo,
    toCloud: runtime.demoToCloud,
  }
}
