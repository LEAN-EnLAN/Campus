import { useState } from 'react'

import type { AcademicItem } from '@/domain/types'
import { itemsToIcs } from '@/features/items/ics'
import { useBackend } from '@/lib/backends/context'
import { downloadFile } from '@/lib/download'

import {
  buildExport,
  calendarFileName,
  exportFileName,
  type ExportProfile,
} from './export-data'

type Pending = 'json' | 'ics' | null

/**
 * The two exports in Ajustes. Each reads fresh from the backend (Local or
 * Cloud, the hook never knows which) and hands the file over in the page.
 */
export function useDataExport() {
  const backend = useBackend()
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: Exclude<Pending, null>, work: () => Promise<void>) {
    if (pending) return
    setPending(kind)
    setError(null)
    try {
      await work()
    } catch {
      setError('No pudimos preparar el archivo. Probá de nuevo en un rato.')
    } finally {
      setPending(null)
    }
  }

  const downloadJson = (profile: ExportProfile) =>
    run('json', async () => {
      const [academicContext, subjectStates, manualSubjects, items, resources] =
        await Promise.all([
          backend.academic.context(),
          backend.academic.subjectStates(),
          backend.academic.manualSubjects(),
          backend.items.list(),
          backend.resources.list(),
        ])
      const now = new Date()
      const data = buildExport(
        { profile, academicContext, subjectStates, manualSubjects, items, resources },
        now,
      )
      downloadFile(
        exportFileName(now),
        JSON.stringify(data, null, 2),
        'application/json;charset=utf-8',
      )
    })

  const downloadCalendar = (subjectName: (item: AcademicItem) => string | null) =>
    run('ics', async () => {
      const items = await backend.items.list()
      const now = new Date()
      downloadFile(
        calendarFileName(now),
        itemsToIcs(items, subjectName, now),
        'text/calendar;charset=utf-8',
      )
    })

  return { downloadJson, downloadCalendar, pending, error }
}
