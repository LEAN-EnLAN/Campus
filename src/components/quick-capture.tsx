import { useEffect, useId, useRef, useState } from 'react'

import type { AcademicItem, AcademicItemKind, SubjectView } from '@/domain/types'
import { finalNoteSentence, finalPrerequisiteNote } from '@/features/items/final-check'
import { combineDue, parseDateInput, parseTimeInput } from '@/features/items/date-input'
import { Button } from './ui/button'
import { Modal } from './ui/modal'
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

export function QuickCapture({
  open,
  onOpenChange,
  subjects,
  defaultSubjectId = null,
  items = [],
  onSubmit,
  isPending = false,
  error = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: readonly SubjectView[]
  defaultSubjectId?: string | null
  /** Items already saved: a Final is checked against the finals already booked. */
  items?: readonly AcademicItem[]
  onSubmit: (values: QuickCaptureValues) => Promise<void> | void
  isPending?: boolean
  error?: string | null
}) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)

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
    submitted && dueTime.trim() !== '' && !time
      ? 'Escribí la hora como hh:mm, por ejemplo 18:30.'
      : null

  // Informational and never blocking: see `final-check.ts`.
  const finalNote = finalPrerequisiteNote(
    {
      kind,
      curriculumSubjectId: subjectId || null,
      dueAt: combineDue(date, time),
      startsAt: null,
    },
    subjects,
    items,
  )

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
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      labelledBy={titleId}
      initialFocus={firstFieldRef}
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

        {finalNote ? (
          <p role="status" className="border-warning text-ink-muted border-l-2 pl-3 text-xs">
            {finalNoteSentence(finalNote)}
          </p>
        ) : null}

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
    </Modal>
  )
}
