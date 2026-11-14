import { Pencil, Trash2 } from 'lucide-react'

import { Button } from './ui/button'

/**
 * Editar / Eliminar at the end of an item row.
 *
 * Two named buttons rather than an overflow menu: one tab stop each, no menu
 * to open on a phone, and each says WHICH item it acts on ("Editar TP 1"), so
 * a screen reader walking a list never hears ten identical "Más opciones".
 * Quiet until the row is hovered or focused on a pointer device; always
 * visible on touch, where there is no hover to reveal them.
 */
export function ItemRowActions({
  title,
  onEdit,
  onDelete,
}: {
  /** The item's title, for the accessible names. */
  title: string
  onEdit?: () => void
  onDelete?: () => void
}) {
  if (!onEdit && !onDelete) return null
  return (
    <span className="-my-1.5 flex shrink-0 items-center gap-0.5 transition-opacity duration-150 pointer-fine:opacity-40 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
      {onEdit ? (
        <Button variant="ghost" size="icon" aria-label={`Editar ${title}`} onClick={onEdit}>
          <Pencil aria-hidden="true" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Eliminar ${title}`}
          onClick={onDelete}
          className="hover:text-danger"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </span>
  )
}
