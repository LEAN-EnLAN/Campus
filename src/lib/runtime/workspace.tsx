import { createContext, use, type ReactNode } from 'react'

import type { VaultDescriptor } from './types'

/**
 * What the student is working IN, and how to leave it.
 *
 * Screens are allowed to ask this and are not allowed to ask "which mode am I
 * in": a folder on this device and an account are both workspaces, and the only
 * things a screen genuinely needs are the folder to name (when there is one)
 * and a way back to the picker. Same reasoning as `useRequiresAccount` — a
 * capability question, answered by the composition root.
 */
export interface WorkspaceValue {
  /** The folder this device opened, or null when the workspace is an account. */
  folder: VaultDescriptor | null
  /** Close this workspace and return to the startup picker. */
  change: () => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceValue
  children: ReactNode
}) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}

export function useWorkspace(): WorkspaceValue {
  const value = use(WorkspaceContext)
  if (!value) throw new Error('useWorkspace debe usarse dentro de <RuntimeProvider>')
  return value
}
