import { useEffect, useId, useRef, useState } from 'react'

import type { AcademicItemKind, SubjectView } from '@/domain/types'
import { combineDue, parseDateInput, parseTimeInput } from '@/features/items/date-input'
import { cn } from '@/lib/utils'

import { Button } from './ui/button'
import { SelectField, TextField } from './ui/field'

/**
 * Quick capture — CAP-CAPTURE-001.
 *
 * Reachable from every screen: Cmd/Ctrl+K on desktop, a bottom sheet on mobile.
 * The fast path is `open → title → date → guardar`; everything else is optional.
 *
 * Hand-built rather than pulled from a dialog library: the POC needs exactly one
 * modal, and focus trap + Escape + restore is ~30 lines we fully control.
 */

const KINDS: { value: AcademicItemKind; label: string }[] = [
  { value: 'assignment', label: 'Entrega' },
  { value: 'midterm', label: 'Parcial' },
  { value: 'final', label: 'Final' },
  { value: 'task', label: 'Tarea' },
  { value: 'registration', label: 'Inscripción' },
  { value: 'class', label: 'Clase' },
  { value: 'custom', label: 'Otro' },
]

/** What the dialog is called: what it is about to add, never "algo". */
const TITLE_BY_KIND: Record<AcademicItemKind, string> = {
  assignment: 'Agregar entrega',
  midterm: 'Agregar parcial',
  final: 'Agregar final',
  task: 'Agregar tarea',
  registration: 'Agregar inscripción',
  class: 'Agregar clase',
  custom: 'Agregar fecha',
}

export interface QuickCaptureValues {
  title: string
  kind: AcademicItemKind
  curriculumSubjectId: string | null
  dueAt: string | null
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function QuickCapture({
  open,
  onOpenChange,
  subjects,
  defaultSubjectId = null,
  onSubmit,
  isPending = false,
  error = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: readonly SubjectView[]
  defaultSubjectId?: string | null
  onSubmit: (values: QuickCaptureValues) => Promise<void> | void
  isPending?: boolean
  error?: string | null
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AcademicItemKind>('assignment')
  const [subjectId, setSubjectId] = useState<string>(defaultSubjectId ?? '')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [touched, setTouched] = useState(false)
  // Date and time complain after a save attempt (or on leaving the field), never
  // while the student is still typing "2" on the way to "23/10/2026".
  const [submitted, setSubmitted] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)

  // Reset on open so a previous capture never leaks into the next one.
  useEffect(() => {
    if (!open) return
    restoreFocusTo.current = document.activeElement as HTMLElement | null
    setTitle('')
    setKind('assignment')
    setSubjectId(defaultSubjectId ?? '')
    setDueDate('')
    setDueTime('')
    setTouched(false)
    setSubmitted(false)
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open, defaultSubjectId])

  // Escape closes; Tab cycles inside the panel.
  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onOpenChange(false)
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
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus()
    }
  }, [open, onOpenChange])

  if (!open) return null

  const trimmed = title.trim()
  const titleError = touched && trimmed.length === 0 ? 'Poné un título.' : null

  // The app's own messages, in the app's own voice. The form opts out of the
  // browser's (`noValidate`), whose text follows the browser language and is
  // never announced next to the field it is about.
  const date = parseDateInput(dueDate)
  const time = parseTimeInput(dueTime)
  const dateError =
    submitted && dueDate.trim() !== '' && !date
      ? 'Escribí la fecha como dd/mm/aaaa, por ejemplo 23/10/2026.'
      : submitted && dueDate.trim() === '' && dueTime.trim() !== ''
        ? 'Elegí también el día.'
        : null
  const timeError =
    touched && dueTime.trim() !== '' && !time
      ? 'Escribí la hora como hh:mm, por ejemplo 18:30.'
      : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    setSubmitted(true)
    // First problem wins the focus, in the order the fields appear.
    if (trimmed.length === 0) {
      firstFieldRef.current?.focus()
      return
    }
    const dateProblem =
      (dueDate.trim() !== '' && !date) || (dueDate.trim() === '' && dueTime.trim() !== '')
    if (dateProblem) {
      dateRef.current?.focus()
      return
    }
    if (dueTime.trim() !== '' && !time) {
      timeRef.current?.focus()
      return
    }

    await onSubmit({
      title: trimmed,
      kind,
      curriculumSubjectId: subjectId || null,
      // A date with no time is DATE-ONLY, recorded as such; it is not due at 23:59.
      dueAt: combineDue(date, time),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-start sm:pt-[12vh]">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => onOpenChange(false)}
        className="bg-ink/25 absolute inset-0 motion-safe:animate-[fade-in_160ms_ease-out]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'border-rule bg-paper-elevated relative w-full max-w-lg border shadow-lg',
          'rounded-t-xl sm:rounded-xl',
          'max-h-[88dvh] overflow-y-auto',
        )}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 p-5 pb-6">
          <h2 id={titleId} className="text-ink font-serif text-lg">
            {TITLE_BY_KIND[kind]}
          </h2>

          <TextField
            ref={firstFieldRef}
            label="¿Qué es?"
            placeholder="TP 4 de Análisis Matemático II"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            error={titleError}
            autoComplete="off"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Tipo"
              value={kind}
              onChange={(e) => setKind(e.target.value as AcademicItemKind)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Materia"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              hint={subjects.length === 0 ? 'Todavía no tenés materias cargadas.' : undefined}
            >
              <option value="">Sin materia</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              ref={dateRef}
              label="Fecha"
              placeholder="dd/mm/aaaa"
              inputMode="numeric"
              autoComplete="off"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => dueDate.trim() !== '' && setSubmitted(true)}
              error={dateError}
            />
            <TextField
              ref={timeRef}
              label="Hora"
              placeholder="hh:mm"
              inputMode="numeric"
              autoComplete="off"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              onBlur={() => dueTime.trim() !== '' && setSubmitted(true)}
              error={timeError}
              hint="Sin hora, queda para todo el día."
            />
          </div>

          {error ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
