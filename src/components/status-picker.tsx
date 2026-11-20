import { useId } from 'react'

import { StatusGlyph } from '@/components/academic-status'
import { statusTone } from '@/components/academic-status-vocabulary'
import type { EntryOption } from '@/domain/progress-entry'
import type { StoredSubjectStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

/**
 * The status of ONE subject as a row of pills that both shows and changes it.
 *
 * Toggle buttons with `aria-pressed` in a named group (the `SegmentedControl`
 * pattern): every option is one Tab stop and announced as pressed or not.
 * Not a radio group on purpose: arrows on radios select as they move, and each
 * selection here is a write that recalculates the plan.
 */
export function StatusPicker({
  label,
  options,
  value,
  onChange,
  disabled = false,
  savedMessage = null,
  className,
}: {
  /** Visible, and the group's accessible name. */
  label: string
  options: readonly EntryOption[]
  value: StoredSubjectStatus | null
  onChange: (value: StoredSubjectStatus | null) => void
  disabled?: boolean
  /** Announced politely after a change lands ("Guardado"). */
  savedMessage?: string | null
  className?: string
}) {
  const labelId = useId()
  return (
    <div className={cn('status-picker', className)}>
      <span id={labelId} className="status-picker-label">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="status-picker-options">
        {options.map((option) => {
          const selected = option.value === value
          const shown = option.value ?? 'pending'
          return (
            <button
              key={option.value ?? 'none'}
              type="button"
              aria-pressed={selected}
              title={option.hint}
              disabled={disabled}
              data-tone={statusTone(shown)}
              className="status-picker-option"
              onClick={() => {
                if (!selected) onChange(option.value)
              }}
            >
              <StatusGlyph status={shown} className="text-current" />
              {option.label}
            </button>
          )
        })}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {savedMessage}
      </span>
    </div>
  )
}
