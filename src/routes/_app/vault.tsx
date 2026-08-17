import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceShell } from '@/components/workspace/workspace-shell'
import { useFiles } from '@/lib/files/context'
import { useRuntimeVaultKey } from '@/lib/runtime/vault-key'

export const Route = createFileRoute('/_app/vault')({
  component: VaultScreen,
})

/**
 * The workspace route. Everything interesting lives in WorkspaceShell; this
 * screen only answers the one question a route may ask: "is there a vault?" —
 * through the files CAPABILITY, never through the runtime mode.
 */
function VaultScreen() {
  const files = useFiles()
  const vaultKey = useRuntimeVaultKey()

  if (!files || !vaultKey) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-sm text-center">
          <svg
            aria-hidden
            viewBox="0 0 96 72"
            className="text-ink-faint mx-auto mb-4 h-20 w-24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M10 20 h28 l6 8 h42 v34 a4 4 0 0 1 -4 4 h-68 a4 4 0 0 1 -4 -4 z" />
            <line x1="10" y1="36" x2="86" y2="36" strokeDasharray="3 4" />
          </svg>
          <h1 className="text-ink text-lg font-semibold">El Vault vive en tu máquina</h1>
          <p className="text-ink-muted mt-2 text-sm">
            Tus notas y archivos son carpetas de verdad, y Campus Cloud no las tiene. Abrí un
            Vault local desde el inicio para usar el espacio de trabajo.
          </p>
        </div>
      </div>
    )
  }

  return <WorkspaceShell vaultKey={vaultKey} />
}
