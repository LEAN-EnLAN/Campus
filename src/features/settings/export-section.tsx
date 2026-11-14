import { CalendarPlus, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAuth } from '@/features/auth/auth-context'
import { useWorkspace } from '@/lib/runtime/workspace'

import type { ExportProfile } from './export-data'
import { useDataExport } from './use-data-export'

/** Anchor other screens link to ("Descargar mis datos" next to deleting the account). */
export const EXPORT_SECTION_ID = 'settings-export'

/**
 * Ajustes → "Tus datos": everything as JSON, and every dated item as one
 * `.ics`. Same card anatomy as the rest of Ajustes.
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
    <section
      id={EXPORT_SECTION_ID}
      className="blue-settings-card"
      aria-labelledby={`${EXPORT_SECTION_ID}-title`}
    >
      <header className="blue-settings-card-head">
        <div className="min-w-0">
          <h2 id={`${EXPORT_SECTION_ID}-title`}>Tus datos</h2>
          <p>Llevate todo lo que cargaste en Campus.</p>
        </div>
      </header>
      <p className="blue-settings-note">
        Los archivos se arman en este dispositivo; no pasan por ningún servidor. El JSON tiene
        tu carrera, el estado de tus materias, tus fechas y tu material. El .ics se abre en
        Google Calendar, Outlook o el calendario del celular.
      </p>
      {error ? (
        <p role="alert" className="blue-settings-error">
          {error}
        </p>
      ) : null}
      <div className="blue-settings-actions">
        <Button
          variant="secondary"
          disabled={pending !== null}
          onClick={() => void downloadJson(profile)}
        >
          <Download aria-hidden="true" />
          {pending === 'json' ? 'Preparando…' : 'Descargar mis datos (JSON)'}
        </Button>
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
      </div>
    </section>
  )
}
