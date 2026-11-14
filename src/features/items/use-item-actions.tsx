import { useState } from 'react'

import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { useToast } from '@/components/toast'
import type { AcademicItem, SubjectView } from '@/domain/types'

import { writeClipboardText } from '@/lib/clipboard'
import { downloadFile } from '@/lib/download'
import { track } from '@/lib/telemetry/track'

import { DeleteItemDialog } from './delete-item-dialog'
import { icsFileName, icsUnavailableReason, itemToIcs } from './ics'
import { useDeleteAcademicItem, useUpdateAcademicItem } from './queries'
import { newShareRef, shareMessage, shareOrigin } from './share'

/**
 * Editing and deleting an item, wherever the student does it (Hoy, the
 * calendar, a subject's Fechas). Same shape as `useCompleteItem`: the screen
 * calls `edit(item)` / `remove(item)` and renders `dialogs`.
 *
 * Editing reuses the capture dialog, so the rules that guard a new item —
 * dd/mm/aaaa, impossible dates, a time with no day — guard an edit too.
 * Both dialogs stay open on failure and show why; the screen never changes.
 *
 * `share(item)` copies the WhatsApp line and its `/add` link; `downloadIcs(item)`
 * hands the item over as a calendar file. Both run on the student's click.
 */
export function useItemActions({
  subjects,
  items,
}: {
  subjects: readonly SubjectView[]
  items: readonly AcademicItem[]
}) {
  const update = useUpdateAcademicItem()
  const destroy = useDeleteAcademicItem()
  const toast = useToast()
  const [editing, setEditing] = useState<AcademicItem | null>(null)
  const [deleting, setDeleting] = useState<AcademicItem | null>(null)

  function edit(item: AcademicItem) {
    if (update.isPending) return
    update.reset()
    setEditing(item)
  }

  function remove(item: AcademicItem) {
    if (destroy.isPending) return
    destroy.reset()
    setDeleting(item)
  }

  async function save(values: QuickCaptureValues) {
    if (!editing) return
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: {
          title: values.title,
          kind: values.kind,
          curriculumSubjectId: values.curriculumSubjectId,
          dueAt: values.dueAt,
        },
      })
      setEditing(null)
      toast.show({ message: `Guardado: ${values.title}` })
    } catch {
      /* surfaced through update.error, inside the dialog */
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const { id, title } = deleting
    try {
      await destroy.mutateAsync(id)
      setDeleting(null)
      toast.show({ message: `Eliminado: ${title}` })
    } catch {
      /* surfaced through destroy.error, inside the dialog */
    }
  }

  const subjectNameOf = (id: string | null) =>
    id ? (subjects.find((subject) => subject.id === id)?.name ?? null) : null

  async function share(item: AcademicItem) {
    // A fresh ref on every copy: it tells two shares apart, never who shared.
    const ref = newShareRef()
    const copied = await writeClipboardText(
      shareMessage(item, {
        origin: shareOrigin(),
        subjectName: subjectNameOf(item.curriculumSubjectId),
        ref,
      }),
    )
    if (!copied) {
      toast.show({ message: 'No se pudo copiar. Probá de nuevo.' })
      return
    }
    toast.show({ message: 'Copiado' })
    track('share_copied', { ref })
  }

  function downloadIcs(item: AcademicItem) {
    if (icsUnavailableReason(item)) return
    downloadFile(
      icsFileName(item.title),
      itemToIcs(item, subjectNameOf(item.curriculumSubjectId)),
      'text/calendar;charset=utf-8',
    )
  }

  const dialogs = (
    <>
      <QuickCapture
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        item={editing}
        subjects={subjects}
        items={items}
        onSubmit={save}
        isPending={update.isPending}
        error={update.error instanceof Error ? update.error.message : null}
      />
      <DeleteItemDialog
        open={deleting !== null}
        title={deleting?.title ?? ''}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        isPending={destroy.isPending}
        error={destroy.error instanceof Error ? destroy.error.message : null}
      />
    </>
  )

  return { edit, remove, share, downloadIcs, dialogs }
}
