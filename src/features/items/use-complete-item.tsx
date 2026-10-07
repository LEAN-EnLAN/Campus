import { useState } from 'react'

import { useToast } from '@/components/toast'
import type { AcademicItem } from '@/domain/types'
import { useSetSubjectStatus } from '@/features/academic/queries'

import { FinalOutcomeDialog, type FinalOutcomeResult } from './final-outcome-dialog'
import { useToggleAcademicItem } from './queries'

/**
 * Marking an item done, wherever the student does it (Hoy, the calendar, the
 * agenda). One place decides what "done" means:
 *
 *   - an ordinary item is done at once, and "Hecho · Deshacer" says so;
 *   - a Final asks how it went first, and offers to update the subject.
 *
 * `dialog` must be rendered by the caller: it is the Final's question.
 */
export function useCompleteItem(subjectName: (subjectId: string | null) => string | null) {
  const toggle = useToggleAcademicItem()
  const setSubjectStatus = useSetSubjectStatus()
  const toast = useToast()
  const [asking, setAsking] = useState<AcademicItem | null>(null)

  function complete(item: AcademicItem, done: boolean) {
    if (done && item.kind === 'final') {
      setAsking(item)
      return
    }
    toggle.mutate({ id: item.id, done })
    // Finishing something used to make the row vanish with no word.
    if (done) {
      toast.show({
        message: 'Hecho',
        action: {
          label: 'Deshacer',
          onAction: () => toggle.mutate({ id: item.id, done: false }),
        },
      })
    }
  }

  function confirmFinal(item: AcademicItem, result: FinalOutcomeResult) {
    toggle.mutate({ id: item.id, done: true })

    if (result.updateSubject && item.curriculumSubjectId && result.outcome !== 'absent') {
      setSubjectStatus.mutate({
        curriculumSubjectId: item.curriculumSubjectId,
        status: result.outcome === 'passed' ? 'passed' : 'failed',
        grade: result.grade,
      })
      const name = subjectName(item.curriculumSubjectId)
      const state = result.outcome === 'passed' ? 'Aprobada' : 'Desaprobada'
      toast.show({ message: name ? `Anotado: ${name} quedó ${state}.` : 'Anotado.' })
    } else {
      toast.show({ message: 'Anotado.' })
    }
    setAsking(null)
  }

  const dialog = asking ? (
    <FinalOutcomeDialog
      open
      title={asking.title}
      subjectName={subjectName(asking.curriculumSubjectId)}
      onConfirm={(result) => confirmFinal(asking, result)}
      onClose={() => setAsking(null)}
    />
  ) : null

  return { complete, dialog }
}
