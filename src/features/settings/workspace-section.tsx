import { ArrowLeftRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import { useWorkspace } from '@/lib/runtime/workspace'

import { SettingsCallout, SettingsPanel, SettingsRow } from './settings-ui'

/** Ajustes → Espacio de trabajo: where this session's data lives, and the way out. */
export function WorkspaceSection() {
  const workspace = useWorkspace()

  return (
    <SettingsPanel
      id="settings-workspace"
      title="Espacio de trabajo"
      description="Dónde están disponibles tus datos en esta sesión."
      art={<Illustration name="settings-workspace" decorative fit="crop" />}
    >
      <SettingsRow label="Espacio actual">
        <p className="settings-value">
          {workspace.folder ? 'En esta computadora' : 'Campus Cloud'}
        </p>
      </SettingsRow>
      {workspace.folder ? (
        <>
          <SettingsRow label="Carpeta">
            <p className="settings-value">{workspace.folder.name}</p>
          </SettingsRow>
          <SettingsRow label="Ubicación">
            <p className="settings-value settings-filepath">{workspace.folder.path}</p>
          </SettingsRow>
        </>
      ) : (
        <SettingsCallout title="Usás tu cuenta Cloud">
          Los archivos de una carpeta Local no se sincronizan automáticamente.
        </SettingsCallout>
      )}
      <SettingsRow label="Cambiar de espacio" helper="Volvé a elegir dónde estudiar.">
        <Button variant="secondary" onClick={workspace.change}>
          <ArrowLeftRight aria-hidden="true" />
          Cambiar de espacio de trabajo
        </Button>
      </SettingsRow>
    </SettingsPanel>
  )
}
