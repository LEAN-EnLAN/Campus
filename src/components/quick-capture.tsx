import { useEffect, useId, useRef, useState } from 'react'

import type { AcademicItemKind, SubjectView } from '@/domain/types'
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (trimmed.length === 0) {
      firstFieldRef.current?.focus()
      return
    }

    // A date with no time means end of day — a TP due "el martes" is not due at 00:00.
    let dueAt: string | null = null
    if (dueDate) {
      const [y, m, d] = dueDate.split('-').map(Number)
      const [hh, mm] = dueTime ? dueTime.split(':').map(Number) : [23, 59]
      dueAt = new Date(y!, m! - 1, d!, hh ?? 23, mm ?? 59).toISOString()
    }

    await onSubmit({
      title: trimmed,
      kind,
      curriculumSubjectId: subjectId || null,
      dueAt,
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 pb-6">
          <h2 id={titleId} className="text-ink font-serif text-lg">
            Agregar algo
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
              label="Fecha"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <TextField
              label="Hora"
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              hint="Si la dejás vacía, queda para el final del día."
              disabled={!dueDate}
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
