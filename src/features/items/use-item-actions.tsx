import { useState } from 'react'

import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { useToast } from '@/components/toast'
import type { AcademicItem, SubjectView } from '@/domain/types'

import { DeleteItemDialog } from './delete-item-dialog'
import { useDeleteAcademicItem, useUpdateAcademicItem } from './queries'

/**
 * Editing and deleting an item, wherever the student does it (Hoy, the
 * calendar, a subject's Fechas). Same shape as `useCompleteItem`: the screen
 * calls `edit(item)` / `remove(item)` and renders `dialogs`.
 *
 * Editing reuses the capture dialog, so the rules that guard a new item —
 * dd/mm/aaaa, impossible dates, a time with no day — guard an edit too.
 * Both dialogs stay open on failure and show why; the screen never changes.
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

  return { edit, remove, dialogs }
}
