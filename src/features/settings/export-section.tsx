import { CalendarPlus, Download, FileDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspace } from '@/lib/runtime/workspace'

import type { ExportProfile } from './export-data'
import { LocalCopySection } from './local-copy-section'
import { SettingsCallout, SettingsPanel, SettingsRow } from './settings-ui'
import { useDataExport } from './use-data-export'

/**
 * Ajustes → "Tus datos": everything as JSON, every dated item as one `.ics`,
 * and — where the device can keep a folder — a standing copy on this computer.
 */
export function ExportSection() {
  const { session } = useAuth()
  const workspace = useWorkspace()
  const plan = useAcademicPlan()
  const { downloadJson, downloadCalendar, pending, error } = useDataExport()

  // Same reading as the rest of Ajustes: a folder means Local, otherwise Cloud.
  const profile: ExportProfile = workspace.folder
    ? { workspace: 'local', folderName: workspace.folder.name }
    : { workspace: 'cloud', email: session?.user.email ?? null }

  return (
    <SettingsPanel
      id="settings-export"
      title="Tus datos"
      description="Llevate todo lo que cargaste en Campus."
      art={<FileDown className="settings-chip-icon" />}
    >
      <SettingsRow
        label="Todo lo que cargaste"
        helper="Un JSON con tu carrera, el estado de tus materias, tus fechas y tu material."
      >
        <Button
          variant="secondary"
          disabled={pending !== null}
          onClick={() => void downloadJson(profile)}
        >
          <Download aria-hidden="true" />
          {pending === 'json' ? 'Preparando…' : 'Descargar mis datos (JSON)'}
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Tus fechas"
        helper="Un .ics que se abre en Google Calendar, Outlook o el calendario del celular."
      >
        <Button
          variant="secondary"
          disabled={pending !== null}
          onClick={() =>
            void downloadCalendar((item) =>
              item.curriculumSubjectId
                ? (plan.subjectById.get(item.curriculumSubjectId)?.name ?? null)
                : null,
            )
          }
        >
          <CalendarPlus aria-hidden="true" />
          {pending === 'ics' ? 'Preparando…' : 'Mis fechas (.ics)'}
        </Button>
      </SettingsRow>
      {error ? (
        <p role="alert" className="settings-error">
          {error}
        </p>
      ) : null}
      <LocalCopySection />
      <SettingsCallout title="Los archivos se arman en este dispositivo">
        No pasan por ningún servidor.
      </SettingsCallout>
    </SettingsPanel>
  )
}
