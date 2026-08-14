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
 */

const controlClass =
  'w-full rounded-md border border-rule bg-paper-elevated px-3 text-sm text-ink ' +
  'placeholder:text-ink-faint transition-colors duration-150 ' +
  'hover:border-ink-faint focus:border-accent ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-55'

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
        <p id={errorId} className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
  error?: string | null
  /** React 19 passes refs as an ordinary prop — no forwardRef needed. */
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, hint, error, className, ...props }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={props.required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, 'h-10', className)}
          {...props}
        />
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
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className={cn(controlClass, 'h-10 appearance-none pr-8', className)}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%236a6862' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center',
          }}
          {...props}
        >
          {children}
        </select>
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
          className={cn(controlClass, 'min-h-20 py-2 leading-relaxed', className)}
          {...props}
        />
      )}
    </Field>
  )
}
