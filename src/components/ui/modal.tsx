import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import { cn } from '@/lib/utils'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The one modal.
 *
 * Hand-built rather than pulled from a dialog library: focus trap, Escape,
 * focus restore and scroll lock are ~40 lines we fully control. Escape closes,
 * Tab cycles inside the panel, and focus goes back to whatever opened it.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  initialFocus,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  /** Id of the element that names the dialog. */
  labelledBy: string
  /** Where focus lands on open. Defaults to the first focusable control. */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)
  // The latest callbacks without re-running the effects that own focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    restoreFocusTo.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      const target =
        initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 20)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus()
    }
  }, [open, initialFocus])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="bg-ink/25 absolute inset-0 motion-safe:animate-[fade-in_160ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'border-rule bg-paper-elevated relative w-full max-w-lg border shadow-lg',
          'rounded-t-xl sm:rounded-xl',
          'max-h-[88dvh] overflow-y-auto',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
