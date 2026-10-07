import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { ENTRY_OPTIONS, entryValueOf, type EntryOption } from '@/domain/progress-entry'
import type { StoredSubjectStatus, SubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

import { statusGlyph } from './academic-status'

/**
 * One tap to say where you are with a subject.
 *
 * Used on the "Cargar mi avance" screen and on every Materias row, so the same
 * four-way choice is learned once. It is a group of toggle buttons, not a
 * radiogroup: the arrows MOVE focus and Enter/Space CHOOSES, because each choice
 * is saved straight away and sweeping across the options with a key must not
 * write three statuses on the way to the fourth.
 *
 * State is carried by the glyph and the word, never by colour alone. The
 * `compact` variant shows glyphs only and names them for assistive technology.
 */

const FAILED: EntryOption = {
  value: 'failed',
  label: 'Desaprobada',
  hint: 'Rendiste el final y no lo aprobaste',
}

const SAVED_FOR_MS = 1800

export function StatusControl({
  subjectName,
  status,
  onChange,
  variant = 'full',
  className,
}: {
  subjectName: string
  status: SubjectStatus
  /** Resolve when the choice is saved; reject with a message the student can read. */
  onChange: (value: StoredSubjectStatus | null) => Promise<unknown> | void
  variant?: 'full' | 'compact'
  className?: string
}) {
  const current = entryValueOf(status)
  // Desaprobada is not something a student enters on this screen, but a subject
  // already stored that way must still show it, or the row would read "Sin marcar".
  const options = current === 'failed' ? [...ENTRY_OPTIONS, FAILED] : ENTRY_OPTIONS

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => () => clearTimeout(timer.current), [])

  async function choose(value: StoredSubjectStatus | null) {
    if (value === current) return
    clearTimeout(timer.current)
    setError(null)
    setSaved(false)
    try {
      await onChange(value)
      setSaved(true)
      timer.current = setTimeout(() => setSaved(false), SAVED_FOR_MS)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = options.length - 1
    const target =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (target === null) return
    event.preventDefault()
    buttons.current[target]?.focus()
  }

  const compact = variant === 'compact'

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <div
        role="group"
        aria-label={`Estado de ${subjectName}`}
        className={cn('flex flex-wrap gap-1.5', compact && 'gap-1')}
      >
        {options.map((option, index) => {
          const pressed = option.value === current
          const label = option.label
          return (
            <button
              key={option.value ?? 'none'}
              ref={(el) => {
                buttons.current[index] = el
              }}
              type="button"
              aria-pressed={pressed}
              aria-label={compact ? label : undefined}
              title={compact ? `${label}: ${option.hint}` : option.hint}
              // One tab stop per row: Tab moves between rows, the arrows within one.
              tabIndex={pressed ? 0 : -1}
              onClick={() => void choose(option.value)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium',
                'transition-colors duration-150',
                // 44px on touch; the pointer-only breakpoint can be tighter.
                compact ? 'size-11 md:size-8' : 'min-h-11 px-3 md:min-h-9',
                pressed
                  ? 'border-accent-ink bg-accent text-on-tint'
                  : 'border-rule bg-paper-elevated text-ink-muted hover:border-ink-faint hover:text-ink',
              )}
            >
              <span aria-hidden="true" className="w-3 text-center leading-none">
                {statusGlyph(option.value ?? 'pending')}
              </span>
              {compact ? null : <span>{label}</span>}
            </button>
          )
        })}
      </div>

      {/* Reserved width, so a row does not jump when the note comes and goes. */}
      <span
        role="status"
        aria-live="polite"
        className="text-ink-muted inline-flex min-h-4 min-w-[4.5rem] items-center gap-1 text-xs"
      >
        {saved ? (
          <>
            <Check aria-hidden="true" className="size-3" />
            Guardado
          </>
        ) : null}
      </span>

      {error ? (
        <p role="alert" className="text-danger basis-full text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}
