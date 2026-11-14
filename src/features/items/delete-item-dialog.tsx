import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

/**
 * "¿Eliminar «Parcial 1»?" — the one confirmation before an item is gone.
 *
 * Focus opens on Cancelar: the safe answer is the one Enter gives. While the
 * delete is in flight nothing can close the dialog, so a failure is read here,
 * next to the button that caused it.
 */
export function DeleteItemDialog({
  open,
  title,
  onConfirm,
  onClose,
  isPending = false,
  error = null,
}: {
  open: boolean
  /** The item's own title, quoted in the question. */
  title: string
  onConfirm: () => void
  onClose: () => void
  isPending?: boolean
  error?: string | null
}) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <Modal
      open={open}
      role="alertdialog"
      onClose={() => {
        if (!isPending) onClose()
      }}
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      {/* No `initialFocus`: the Modal lands on the first control, Cancelar. */}
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <h2 id={titleId} className="text-ink font-serif text-lg">
          ¿Eliminar «{title}»?
        </h2>
        <p id={descriptionId} className="text-ink-muted text-sm">
          Desaparece de Hoy, del calendario y de la materia. No se puede deshacer.
        </p>

        {error ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {error}
          </p>
        ) : null}

        <div className="border-rule-soft mt-1 flex justify-end gap-2 border-t pt-4">
          <Button variant="ghost" disabled={isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={isPending}
            aria-busy={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
