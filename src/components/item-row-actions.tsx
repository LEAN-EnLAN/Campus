import { CalendarPlus, Pencil, Share2, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './ui/button'

/**
 * Compartir / .ics / Editar / Eliminar at the end of an item row.
 *
 * Named buttons rather than an overflow menu: one tab stop each, no menu
 * to open on a phone, and each says WHICH item it acts on ("Editar TP 1"), so
 * a screen reader walking a list never hears ten identical "Más opciones".
 * Quiet until the row is hovered or focused on a pointer device; always
 * visible on touch, where there is no hover to reveal them.
 */
export function ItemRowActions({
  title,
  onShare,
  onDownloadIcs,
  icsDisabledReason = null,
  onEdit,
  onDelete,
}: {
  /** The item's title, for the accessible names. */
  title: string
  onShare?: () => void
  onDownloadIcs?: () => void
  /** Why the .ics cannot be made (no date). The button stays, disabled, saying so. */
  icsDisabledReason?: string | null
  onEdit?: () => void
  onDelete?: () => void
}) {
  if (!onShare && !onDownloadIcs && !onEdit && !onDelete) return null
  return (
    <span className="-my-1.5 flex shrink-0 items-center gap-0.5 transition-opacity duration-150 pointer-fine:opacity-40 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100">
      {onShare ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Copiar ${title} para WhatsApp`}
          title="Copiar para WhatsApp"
          onClick={onShare}
        >
          <Share2 aria-hidden="true" />
        </Button>
      ) : null}
      {onDownloadIcs ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Descargar .ics de ${title}`}
          // aria-disabled, not disabled: it stays focusable, so the reason is
          // reachable by keyboard and read as the button's description.
          aria-disabled={icsDisabledReason ? true : undefined}
          title={icsDisabledReason ?? 'Descargar .ics'}
          onClick={icsDisabledReason ? undefined : onDownloadIcs}
          className={cn(
            icsDisabledReason && 'cursor-not-allowed opacity-40 hover:bg-transparent',
          )}
        >
          <CalendarPlus aria-hidden="true" />
        </Button>
      ) : null}
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
