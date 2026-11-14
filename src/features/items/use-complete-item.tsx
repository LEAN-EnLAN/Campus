import { useState } from 'react'

import { useToast } from '@/components/toast'
import type { AcademicItem } from '@/domain/types'
import { useSetSubjectStatus } from '@/features/academic/queries'

import { FinalOutcomeDialog, type FinalOutcomeResult } from './final-outcome-dialog'
import { useToggleAcademicItem } from './queries'

const DONE_FAILED = 'No pudimos marcarla como hecha. Probá de nuevo.'
const OPEN_FAILED = 'No pudimos marcarla como pendiente. Probá de nuevo.'
const SUBJECT_FAILED =
  'Quedó como hecha, pero no pudimos actualizar la materia. Cambiala desde su página.'

/**
 * Marking an item done, wherever the student does it (Hoy, the calendar, the
 * agenda, a subject's Fechas). One place decides what "done" means:
 *
 *   - an ordinary item is done at once, and "Marcada como hecha · Deshacer" says so;
 *   - a Final asks how it went first, and offers to update the subject;
 *   - a failure says so in a toast: the row did not change, and silence made the
 *     student tap again.
 *
 * `isPending(id)` is true while that item's change is in flight: its control is
 * disabled, so a double tap cannot send the opposite change right behind it.
 *
 * `dialog` must be rendered by the caller: it is the Final's question.
 */
export function useCompleteItem(subjectName: (subjectId: string | null) => string | null) {
  const toggle = useToggleAcademicItem()
  const setSubjectStatus = useSetSubjectStatus()
  const toast = useToast()
  const [asking, setAsking] = useState<AcademicItem | null>(null)
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set())

  function track(id: string, inFlight: boolean) {
    setPending((current) => {
      const next = new Set(current)
      if (inFlight) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** `mutateAsync`, not `mutate`: each call gets its own outcome even when two overlap. */
  async function setDone(item: AcademicItem, done: boolean): Promise<boolean> {
    track(item.id, true)
    try {
      await toggle.mutateAsync({ id: item.id, done })
      return true
    } catch {
      toast.show({ tone: 'error', message: done ? DONE_FAILED : OPEN_FAILED })
      return false
    } finally {
      track(item.id, false)
    }
  }

  async function markOpen(item: AcademicItem) {
    if (await setDone(item, false)) toast.show({ message: 'Marcada como pendiente' })
  }

  async function complete(item: AcademicItem, done: boolean) {
    if (pending.has(item.id)) return
    if (done && item.kind === 'final') {
      setAsking(item)
      return
    }
    if (!done) {
      await markOpen(item)
      return
    }
    // Finishing something used to make the row vanish with no word.
    if (await setDone(item, true)) {
      toast.show({
        message: 'Marcada como hecha',
        action: { label: 'Deshacer', onAction: () => void markOpen(item) },
      })
    }
  }

  async function confirmFinal(item: AcademicItem, result: FinalOutcomeResult) {
    setAsking(null)
    if (!(await setDone(item, true))) return

    if (result.updateSubject && item.curriculumSubjectId && result.outcome !== 'absent') {
      try {
        await setSubjectStatus.mutateAsync({
          curriculumSubjectId: item.curriculumSubjectId,
          status: result.outcome === 'passed' ? 'passed' : 'failed',
          grade: result.grade,
        })
      } catch {
        toast.show({ tone: 'error', message: SUBJECT_FAILED })
        return
      }
      const name = subjectName(item.curriculumSubjectId)
      const state = result.outcome === 'passed' ? 'Aprobada' : 'Desaprobada'
      toast.show({ message: name ? `Anotado: ${name} quedó ${state}.` : 'Anotado.' })
    } else {
      toast.show({ message: 'Anotado.' })
    }
  }

  const dialog = asking ? (
    <FinalOutcomeDialog
      open
      title={asking.title}
      subjectName={subjectName(asking.curriculumSubjectId)}
      onConfirm={(result) => void confirmFinal(asking, result)}
      onClose={() => setAsking(null)}
    />
  ) : null

  return {
    complete: (item: AcademicItem, done: boolean) => void complete(item, done),
    isPending: (id: string) => pending.has(id),
    dialog,
  }
}
