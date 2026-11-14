import { useEffect, useId, useRef, useState } from 'react'

import type { AcademicItem, AcademicItemKind, SubjectView } from '@/domain/types'
import { finalNoteSentence, finalPrerequisiteNote } from '@/features/items/final-check'
import {
  combineDue,
  dueToInputs,
  parseDateInput,
  parseTimeInput,
} from '@/features/items/date-input'
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

/** The same dialog, editing: "Editar parcial", never a second form. */
const EDIT_TITLE_BY_KIND: Record<AcademicItemKind, string> = {
  assignment: 'Editar entrega',
  midterm: 'Editar parcial',
  final: 'Editar final',
  task: 'Editar tarea',
  registration: 'Editar inscripción',
  class: 'Editar clase',
  custom: 'Editar fecha',
}

export interface QuickCaptureValues {
  title: string
  kind: AcademicItemKind
  curriculumSubjectId: string | null
  dueAt: string | null
}

/** Any subset of a new item's fields; a null kind means "the default kind". */
export interface QuickCaptureInitialValues {
  title?: string
  kind?: AcademicItemKind | null
  curriculumSubjectId?: string | null
  dueAt?: string | null
}

export function QuickCapture({
  open,
  onOpenChange,
  subjects,
  defaultSubjectId = null,
  defaultKind = 'assignment',
  items = [],
  onSubmit,
  isPending = false,
  error = null,
  item = null,
  initialValues = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subjects: readonly SubjectView[]
  defaultSubjectId?: string | null
  /** The kind the form opens on ("Agendar final" opens on `final`). */
  defaultKind?: AcademicItemKind
  /** Items already saved: a Final is checked against the finals already booked. */
  items?: readonly AcademicItem[]
  onSubmit: (values: QuickCaptureValues) => Promise<void> | void
  isPending?: boolean
  error?: string | null
  /** The item being edited. Absent, the dialog adds a new one. */
  item?: AcademicItem | null
  /**
   * A new item's fields filled in advance (a shared link). Nothing is saved
   * until the student presses Guardar. Ignored when editing.
   */
  initialValues?: QuickCaptureInitialValues | null
}) {
  const titleId = useId()
  const firstFieldRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<AcademicItemKind>(defaultKind)
  const [subjectId, setSubjectId] = useState<string>(defaultSubjectId ?? '')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  // The title complains only after a save attempt — never on leaving the field.
  // On blur, the message pushed the footer down mid-click, so pressing Cancelar
  // on an empty form first raised "Poné un título." and missed the button.
  const [touched, setTouched] = useState(false)
  // Date and time complain after a save attempt (or on leaving the field), never
  // while the student is still typing "2" on the way to "23/10/2026".
  const [submitted, setSubmitted] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  // `isPending` arrives a render late; a double click lands before it does.
  const submitting = useRef(false)

  // Primitives, not the item object: a background refetch hands over a new
  // object for the same item, and that must not wipe what the student typed.
  const editingId = item?.id ?? null
  const prefill = item ? null : initialValues
  const editingTitle = item?.title ?? prefill?.title ?? ''
  const editingKind = item?.kind ?? prefill?.kind ?? defaultKind
  const editingSubject = item
    ? (item.curriculumSubjectId ?? '')
    : prefill
      ? (prefill.curriculumSubjectId ?? '')
      : (defaultSubjectId ?? '')
  const editingDueAt = item ? item.dueAt : (prefill?.dueAt ?? null)
  const initialDue = dueToInputs(editingDueAt)

  // Reset on open so a previous capture never leaks into the next one; editing,
  // start from what is stored.
  useEffect(() => {
    if (!open) return
    const due = dueToInputs(editingDueAt)
    setTitle(editingTitle)
    setKind(editingKind)
    setSubjectId(editingSubject)
    setDueDate(due.date)
    setDueTime(due.time)
    setTouched(false)
    setSubmitted(false)
    const timer = window.setTimeout(() => firstFieldRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [open, editingId, editingTitle, editingKind, editingSubject, editingDueAt])

  if (!open) return null
  const editing = editingId !== null

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
    // The stored copy of the item being edited is stale by definition.
    editing ? items.filter((other) => other.id !== editingId) : items,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (isPending || submitting.current) return
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

    submitting.current = true
    try {
      await onSubmit({
        title: trimmed,
        kind,
        curriculumSubjectId: subjectId || null,
        // A date with no time is DATE-ONLY, recorded as such; it is not due at 23:59.
        // An edit that left the date alone keeps the stored instant exactly.
        dueAt:
          editing && dueDate === initialDue.date && dueTime === initialDue.time
            ? editingDueAt
            : combineDue(date, time),
      })
    } finally {
      submitting.current = false
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onOpenChange(false)
      }}
      labelledBy={titleId}
      initialFocus={firstFieldRef}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-4 p-4 sm:p-6"
      >
        <h2 id={titleId} className="text-ink font-serif text-lg">
          {(editing ? EDIT_TITLE_BY_KIND : TITLE_BY_KIND)[kind]}
        </h2>
        <p className="text-ink-muted -mt-2 text-sm">
          {editing
            ? 'Cambiá lo que necesites. La materia y la fecha son opcionales.'
            : 'Anotá lo importante. La materia y la fecha son opcionales.'}
        </p>

        <TextField
          ref={firstFieldRef}
          label="¿Qué es?"
          placeholder="TP 4 de Análisis Matemático II"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={titleError}
          autoComplete="off"
          required
        />

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
            {/* An item whose subject is no longer in the plan keeps it unless
                the student picks another: an edit never clears it silently. */}
            {subjectId && !subjects.some((s) => s.id === subjectId) ? (
              <option value={subjectId}>Materia actual</option>
            ) : null}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-3">
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
            // Only while it is true: with a time typed it contradicts the form.
            hint={dueTime.trim() === '' ? 'Sin hora, queda para todo el día.' : undefined}
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

        <div className="border-rule-soft mt-1 flex justify-end gap-2 border-t pt-4">
          <Button
            variant="ghost"
            disabled={isPending}
            // Keep the focus where it is: a blur here would let a field show its
            // message and move this button out from under the pointer mid-click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
