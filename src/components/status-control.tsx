import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

import { StatusGlyph, statusLabel } from '@/components/academic-status'
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
  className,
}: {
  subjectName: string
  status: SubjectStatus
  onChange: (value: StoredSubjectStatus | null) => Promise<unknown> | void
  variant?: 'full' | 'compact'
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

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!open) return
    // Focus a visible option after the portal exists, without writing a value.
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    // Scrolling/re-sizing changes the anchor's geometry: close rather than
    // leave a disconnected menu floating over a different subject.
    const dismissOnScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', dismissOnScroll)
    window.addEventListener('scroll', dismissOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', dismissOnScroll)
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

  return (
    <div className={cn('inline-flex min-w-0 flex-col items-start gap-1', className)}>
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
            'border-rule bg-paper-elevated text-ink hover:border-accent-ink hover:bg-accent-soft inline-flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-semibold shadow-sm transition-colors',
            variant === 'compact' ? 'min-w-32' : 'min-w-36',
            saving && 'cursor-wait opacity-70',
          )}
        >
          {saving ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <StatusGlyph status={displayStatus ?? 'pending'} />
          )}
          <span className="flex-1 text-left">{displayLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>
      <span
        role="status"
        aria-live="polite"
        className="text-ink-muted inline-flex min-h-4 items-center gap-1 text-xs"
      >
        {saved ? (
          <>
            <Check aria-hidden="true" className="size-3" />
            Guardado
          </>
        ) : null}
      </span>
      {error ? (
        <p role="alert" className="text-danger max-w-60 text-xs font-medium">
          {error}
        </p>
      ) : null}
      {open &&
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
          document.body,
        )}
    </div>
  )
}
