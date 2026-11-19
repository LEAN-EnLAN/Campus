import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * Form field primitives.
 *
 * Every control is wired to its label and, when present, its error — via real
 * `htmlFor` / `aria-describedby` / `aria-invalid`, not visual proximity. Error
 * text is never colour-only: it carries words.
 *
 * Look: 48px tall, 12px radius, label above, a soft FILLED surface instead of a
 * bordered box, and a 2px accent ring on focus. The hairline edge stays (WCAG
 * 1.4.11 wants the control's boundary findable) — the fill is what makes it read
 * as a place to type rather than a browser default.
 */
export const fieldControlClass =
  'w-full rounded-lg border border-field/45 bg-paper-sunken px-3.5 text-base text-ink sm:text-sm ' +
  'placeholder:text-ink-faint transition-[border-color,box-shadow,background-color] duration-150 ease-out-expo ' +
  'hover:border-field focus:border-focus focus:bg-paper-elevated focus:outline-none ' +
  'focus:ring-2 focus:ring-focus/35 ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/25 ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

/** Height of a single-line control. 48px: one comfortable thumb target. */
export const fieldHeightClass = 'h-12'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  children: (ids: {
    id: string
    describedBy: string | undefined
    invalid: boolean
  }) => ReactNode
  className?: string
}

export function Field({ label, hint, error, required, children, className }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-ink text-sm font-medium">
        {label}
        {required ? (
          <span className="text-ink-muted ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint ? (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      ) : null}

      {error ? (
        // `role="alert"`: a message that appears next to a field the student
        // cannot see (or is not looking at) has to be announced, not just drawn.
        <p id={errorId} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A decorative icon at the start of a control. Give the control `pl-10` to
 * make room; the icon is `aria-hidden` because the label already names it.
 */
export function FieldLeadingIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="text-ink-muted pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 [&_svg]:size-4"
    >
      {children}
    </span>
  )
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
  error?: string | null
  /** A decorative icon inside the control, before the text. */
  leadingIcon?: ReactNode
  /** React 19 passes refs as an ordinary prop — no forwardRef needed. */
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, hint, error, leadingIcon, className, ...props }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leadingIcon ? <FieldLeadingIcon>{leadingIcon}</FieldLeadingIcon> : null}
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={cn(fieldControlClass, fieldHeightClass, leadingIcon && 'pl-10', className)}
            {...props}
          />
        </div>
      )}
    </Field>
  )
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string
  hint?: string
  error?: string | null
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={cn(fieldControlClass, fieldHeightClass, 'appearance-none pr-9', className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="text-ink-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
          />
        </div>
      )}
    </Field>
  )
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string
  hint?: string
  error?: string | null
}

export function TextareaField({ label, hint, error, className, ...props }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(fieldControlClass, 'min-h-24 py-3 leading-relaxed', className)}
          {...props}
        />
      )}
    </Field>
  )
}
