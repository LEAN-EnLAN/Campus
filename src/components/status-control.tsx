import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { StatusGlyph, statusLabel } from '@/components/academic-status'
import { statusChipClass } from '@/components/academic-status-vocabulary'
import { ENTRY_OPTIONS, entryValueOf, type EntryOption } from '@/domain/progress-entry'
import type { StoredSubjectStatus, SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

const FAILED: EntryOption = {
  value: 'failed',
  label: 'Desaprobada',
  hint: 'Rendiste el final y no lo aprobaste',
}
const SAVED_FOR_MS = 1800

/**
 * One status button per subject, with a portal-backed choice list. The portal
 * avoids clipping behind scrollable plan rows; moving focus never changes data.
 * Writes still go through the caller's Local/Cloud mutation.
 */
export function StatusControl({
  subjectName,
  status,
  onChange,
  variant = 'full',
  savedLabel = 'Guardado',
  className,
}: {
  subjectName: string
  status: SubjectStatus
  onChange: (value: StoredSubjectStatus | null) => Promise<unknown> | void
  variant?: 'full' | 'compact'
  /** What the live region says after a change. The simulator does not save. */
  savedLabel?: string
  className?: string
}) {
  const current = entryValueOf(status)
  const options = current === 'failed' ? [...ENTRY_OPTIONS, FAILED] : ENTRY_OPTIONS
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 238 })
  const [host, setHost] = useState<Element | null>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    // Focus a visible option after the portal exists, without writing a value.
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    function onPointer(event: PointerEvent) {
      const target = event.target
      if (isInside(menuRef.current, target) || isInside(triggerRef.current, target)) return
      setOpen(false)
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    // Scrolling/re-sizing changes the anchor's geometry: close rather than
    // leave a disconnected menu floating over a different subject.
    //
    // Only when the anchor actually MOVED. Scroll events are delivered a frame
    // late, so the scroll that brought the trigger into view (a tap right after
    // a fling, or a test driver's scroll-into-view) arrived after the menu had
    // opened and shut it again: the first click "did nothing".
    const anchoredAt = triggerRef.current?.getBoundingClientRect()
    const dismissOnScroll = (event: Event) => {
      if (isInside(menuRef.current, event.target)) return
      const now = triggerRef.current?.getBoundingClientRect()
      if (anchoredAt && now && !moved(anchoredAt, now)) return
      setOpen(false)
    }
    // A resize re-flows the page; the menu's place was computed for the old one.
    const dismissOnResize = () => setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', dismissOnResize)
    window.addEventListener('scroll', dismissOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', dismissOnResize)
      window.removeEventListener('scroll', dismissOnScroll, true)
    }
  }, [open])

  function toggle() {
    if (saving || open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(238, window.innerWidth - 16)
    const height = Math.min(options.length * 49 + 16, 310)
    const above = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12
    setPosition({
      top: above
        ? Math.max(8, rect.top - height - 6)
        : Math.min(rect.bottom + 6, window.innerHeight - height - 8),
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
    })
    setHost(portalHost(triggerRef.current))
    setOpen(true)
  }

  async function choose(value: StoredSubjectStatus | null) {
    setOpen(false)
    triggerRef.current?.focus()
    if (value === current || saving) return
    clearTimeout(timer.current)
    setSaved(false)
    setError(null)
    setSaving(true)
    try {
      await onChange(value)
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), SAVED_FOR_MS)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el estado.')
    } finally {
      setSaving(false)
    }
  }

  function onOptionKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? (index + 1) % options.length
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? (index + options.length - 1) % options.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    menuRef.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
  }

  const displayStatus = status === 'available' || status === 'blocked' ? status : current
  const displayLabel = displayStatus === null ? 'Sin marcar' : statusLabel(displayStatus)

  const shown = displayStatus ?? 'pending'

  return (
    // Only the trigger takes layout space, so a row can centre it against its own
    // content. Save feedback lives INSIDE the trigger (the chevron turns into a
    // check) plus a live region; a line under the button pushed it 10px off-centre.
    <div className={cn('inline-flex min-w-0 flex-col items-end gap-1', className)}>
      <div role="group" aria-label={`Estado de ${subjectName}`}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Estado de ${subjectName}: ${displayLabel}. Cambiar estado`}
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          aria-haspopup="true"
          disabled={saving}
          onClick={toggle}
          className={cn(
            // A tinted chip in the status's own tone: the column of chips is what
            // makes a long list scannable. 32px visible, 44px to the touch (the
            // ::after extends the hit area without changing the row's height).
            'relative inline-flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2.5 text-xs font-medium whitespace-nowrap',
            'after:absolute after:inset-x-0 after:-inset-y-1.5',
            'transition-shadow duration-150 hover:ring-1 hover:ring-current/30',
            statusChipClass(shown),
            variant === 'full' ? 'min-w-36 justify-between' : 'min-w-28 justify-between',
            saving && 'cursor-wait',
          )}
        >
          {saving ? (
            <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          ) : variant === 'full' ? (
            <StatusGlyph status={shown} className="text-current" />
          ) : null}
          <span className="flex-1 text-left">{displayLabel}</span>
          {saved ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
          ) : (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-3.5 shrink-0 opacity-70 transition-transform',
                open && 'rotate-180',
              )}
            />
          )}
        </button>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {saved ? savedLabel : null}
      </span>
      {error ? (
        <p role="alert" className="text-danger max-w-60 text-right text-xs font-medium">
          {error}
        </p>
      ) : null}
      {open &&
        host &&
        createPortal(
          <div
            id={menuId}
            ref={menuRef}
            role="group"
            aria-label={`Elegir estado de ${subjectName}`}
            className="campus-status-menu"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.map((option, index) => (
              <button
                key={option.value ?? 'none'}
                type="button"
                aria-pressed={option.value === current}
                title={option.hint}
                onClick={() => void choose(option.value)}
                onKeyDown={(event) => onOptionKey(event, index)}
                className="campus-status-option"
              >
                <StatusGlyph status={option.value ?? 'pending'} />
                <span className="flex-1 text-left">{option.label}</span>
                {option.value === current ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : null}
              </button>
            ))}
          </div>,
          host,
        )}
    </div>
  )
}

/**
 * `contains` with a type guard. An event's target is not always a Node — a
 * `resize` is dispatched on `window` — and `Node.contains(window)` throws
 * ("parameter 1 is not of type 'Node'").
 */
function isInside(root: Node | null, target: EventTarget | null): boolean {
  return root !== null && target instanceof Node && root.contains(target)
}

function moved(before: DOMRect, after: DOMRect): boolean {
  return Math.abs(before.top - after.top) > 1 || Math.abs(before.left - after.left) > 1
}

/**
 * The menu is portaled out of scrolling rows, but NOT out of the Campus Blue
 * scope: under `<body>` its tokens resolved to the legacy warm palette (a beige
 * menu over a blue screen). The nearest `.campus-blue` keeps the role values.
 */
function portalHost(anchor: HTMLElement | null): Element {
  return anchor?.closest('.campus-blue') ?? document.body
}
