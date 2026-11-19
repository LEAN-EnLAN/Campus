import { createContext, use } from 'react'

/**
 * "Guardar también una copia en esta computadora" — as a capability.
 *
 * Settings and the one-time question ask THIS, never the runtime's mode: the
 * value is null wherever a local copy makes no sense (a local workspace, the
 * demo, a hosted build with no folder access), and they render nothing.
 */
export interface LocalCopyValue {
  /** null: this device was never asked. */
  enabled: boolean | null
  /** The folder the copy goes to, as the machine writes it. */
  folder: string | null
  /** Whether to ask now: signed in, never answered on this device. */
  shouldAsk: boolean
  status: 'idle' | 'copying' | 'copied' | 'error'
  lastCopiedAt: Date | null
  error: string | null
  /** Turn the copy on (into `folder`, or the suggested one) and copy right away. */
  enable(folder?: string): Promise<void>
  /** Turn it off. The folder and its files stay where they are. */
  disable(): void
  copyNow(): Promise<void>
}

export const LocalCopyContext = createContext<LocalCopyValue | null>(null)

export function useLocalCopy(): LocalCopyValue | null {
  return use(LocalCopyContext)
}
