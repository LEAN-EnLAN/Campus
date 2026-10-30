import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
} from 'react'

import { cn } from '@/lib/utils'

import { tabbables } from './tabbable'

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
        initialFocus?.current ?? (panelRef.current ? tabbables(panelRef.current)[0] : undefined)
      target?.focus()
    }, 20)

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = tabbables(panelRef.current)
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
    <div className="sm:pt-dialog-top fixed inset-0 z-50 flex items-end justify-center sm:items-start">
      {/* Pointer-only dismiss. Escape and the dialog's own Cancel are the keyboard
          paths, so this stays out of the tab order and the accessibility tree. */}
      <div
        aria-hidden="true"
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
          'max-h-sheet sm:max-h-dialog overflow-y-auto overscroll-contain',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * The action row of a dialog. Sticks to the bottom of the scrolling panel so
 * Save / Cancel stay reachable on a short viewport or with the keyboard open.
 */
export function ModalFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn(
        'bg-paper-elevated border-rule sticky bottom-0 -mx-5 mt-1 flex justify-end gap-2 border-t px-5 py-3',
        'pb-safe',
        className,
      )}
      {...props}
    />
  )
}
