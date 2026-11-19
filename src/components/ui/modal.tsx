import { X } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
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
 *
 * Look: a centred 24px-radius sheet on desktop, a bottom sheet on a phone, over
 * a blurred backdrop. Enters with a 180ms fade + 8px rise (ease-out-expo) and
 * leaves in 120ms. With reduced motion there is no movement and no exit delay:
 * the panel simply goes.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  initialFocus,
  children,
  className,
  role = 'dialog',
  describedBy,
}: {
  open: boolean
  onClose: () => void
  /** Id of the element that names the dialog. */
  labelledBy: string
  /** Where focus lands on open. Defaults to the first focusable control. */
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  /** `alertdialog` for a confirmation that interrupts, like deleting something. */
  role?: 'dialog' | 'alertdialog'
  /** Id of the element that explains it — what an alert dialog is asking. */
  describedBy?: string
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

  const closing = useExitDelay(open)
  if (!open && !closing) return null

  return (
    <div
      data-state={open ? 'open' : 'closing'}
      className={cn(
        'group/modal sm:pt-dialog-top fixed inset-0 z-50 flex items-end justify-center sm:items-start',
        !open && 'pointer-events-none',
      )}
    >
      {/* Pointer-only dismiss. Escape and the dialog's own Cancel are the keyboard
          paths, so this stays out of the tab order and the accessibility tree. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'bg-ink/30 absolute inset-0 backdrop-blur-[6px]',
          'motion-safe:animate-backdrop-in',
          'transition-opacity duration-(--duration-exit) group-data-[state=closing]/modal:opacity-0',
        )}
      />

      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          'border-rule bg-paper-elevated shadow-floating relative w-full max-w-lg border',
          'rounded-t-3xl sm:rounded-3xl',
          'max-h-sheet sm:max-h-dialog overflow-y-auto overscroll-contain',
          'motion-safe:animate-sheet-up sm:motion-safe:animate-sheet-in',
          'transition-[opacity,translate] duration-(--duration-exit) ease-out',
          'group-data-[state=closing]/modal:translate-y-2 group-data-[state=closing]/modal:opacity-0',
          className,
        )}
      >
        {/* The grab handle a bottom sheet wears on a phone. Decorative. */}
        <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
          <span className="bg-rule rounded-pill h-1 w-10" />
        </div>
        {children}
      </div>
    </div>
  )
}

const EXIT_MS = 120

/**
 * True for the 120ms after `open` turns false, so the panel can play its exit.
 * Never true when the student asked for reduced motion (or the environment
 * cannot tell, as in tests): then a closed dialog leaves the DOM at once.
 */
function useExitDelay(open: boolean): boolean {
  const [closing, setClosing] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setClosing(!open && allowsMotion())
  }
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setClosing(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])
  return closing
}

function allowsMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  )
}

const TONES = {
  accent: 'bg-accent-soft text-accent-ink',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning',
} as const

/**
 * The top of a dialog: an optional tinted icon chip, the title (which names the
 * dialog through `titleId`), and one line saying what it is for.
 * Pass `onClose` to add a close button; most dialogs already have Cancel.
 */
export function ModalHeader({
  titleId,
  title,
  description,
  descriptionId,
  icon,
  tone = 'accent',
  onClose,
  className,
}: {
  titleId: string
  title: ReactNode
  description?: ReactNode
  /** Give it when the dialog's `describedBy` points at this line. */
  descriptionId?: string
  /** A lucide icon, shown in a tinted chip. Decorative. */
  icon?: ReactNode
  tone?: keyof typeof TONES
  onClose?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3.5', className)}>
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5',
            TONES[tone],
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 id={titleId} className="text-ink text-lg leading-snug font-semibold tracking-tight">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-ink-muted mt-0.5 text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-ink-muted hover:bg-paper-sunken hover:text-ink -mt-1 -mr-1 grid size-9 shrink-0 place-items-center rounded-lg transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
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
        'bg-paper-elevated border-rule sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap justify-end gap-2 border-t px-4 py-3',
        'sm:-mx-6 sm:px-6 sm:py-4',
        'pb-safe',
        className,
      )}
      {...props}
    />
  )
}
