import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useRef, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { StatusControl } from '@/components/status-control'
import { Button } from '@/components/ui/button'
import { listOrderConflicts, orderConflictMessage } from '@/domain/consistency'
import { approveYear, revertChanges, type StatusChange } from '@/domain/progress-entry'
import type { SubjectView } from '@/domain/types'
import type { SetSubjectStatusInput } from '@/lib/backends/types'

import { useDismissedNotes } from './dismissed-notes'
import { manualSubjectsBanner } from './manual-subjects'
import { useAcademicPlan, useSetSubjectStatus, useSetSubjectStatuses } from './queries'

const TERM_LABEL: Record<SubjectView['term'], string> = {
  anual: 'Anual',
  '1c': '1° cuatr.',
  '2c': '2° cuatr.',
}

interface Undo {
  yearLevel: number
  changes: StatusChange[]
}

/**
 * "Cargar mi avance" — a student's whole history, set in one sitting.
 *
 * Every choice is saved the moment it is made, so there is no Guardar to forget.
 * Nothing is validated against correlativas while entering (the student knows
 * about equivalencias better than the plan does); once they say "Listo", the
 * contradictions are listed in ONE place, quietly, never as a block.
 */
export function ProgressEntryScreen() {
  const plan = useAcademicPlan()
  const setStatus = useSetSubjectStatus()
  const setMany = useSetSubjectStatuses()
  const { isDismissed } = useDismissedNotes()

  const [undo, setUndo] = useState<Undo | null>(null)
  const [done, setDone] = useState(false)
  const summary = useRef<HTMLElement>(null)

  if (plan.isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Contanos hasta dónde llegaste" />
        <LoadingRows rows={8} />
      </div>
    )
  }
  if (plan.error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Contanos hasta dónde llegaste" />
        <ErrorState error={plan.error} />
      </div>
    )
  }
  if (!plan.hasContext) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Contanos hasta dónde llegaste" />
        <EmptyState
          title="Todavía no elegiste tu carrera"
          description="Elegí universidad, facultad, carrera y plan para cargar tu avance."
          action={
            <Link
              to="/onboarding"
              className="text-accent-ink text-sm font-medium underline-offset-4 hover:underline"
            >
              Elegir mi carrera
            </Link>
          }
        />
      </div>
    )
  }
  if (plan.views.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Contanos hasta dónde llegaste" />
        <EmptyState
          title="Todavía no hay materias para marcar"
          description={
            plan.isUnmapped
              ? 'Primero cargá tus materias a mano en tu plan, y después volvé a marcar en qué estás.'
              : 'Cuando tengamos las materias de tu plan, las vas a poder marcar acá.'
          }
          action={
            <Link
              to="/plan"
              className="text-accent-ink text-sm font-medium underline-offset-4 hover:underline"
            >
              Ir a tu plan
            </Link>
          }
        />
      </div>
    )
  }

  const byId = new Map(plan.views.map((v) => [v.id, v]))
  const toInput = (
    subjectId: string,
    status: SetSubjectStatusInput['status'],
  ): SetSubjectStatusInput => ({
    curriculumSubjectId: subjectId,
    status,
    ...(byId.get(subjectId)?.manual ? { manual: true } : {}),
  })

  function approve(yearLevel: number) {
    const changes = approveYear(plan.views, yearLevel)
    if (changes.length === 0) return
    setUndo({ yearLevel, changes })
    setMany.mutate(changes.map((c) => toInput(c.subjectId, c.to)))
  }

  function revert() {
    if (!undo) return
    setMany.mutate(revertChanges(undo.changes).map((c) => toInput(c.subjectId, c.status)))
    setUndo(null)
  }

  function finish() {
    setDone(true)
    // The summary is the point of the click: bring it into view and to the reader.
    requestAnimationFrame(() => summary.current?.focus())
  }

  const conflicts = listOrderConflicts(plan.views).filter((c) => !isDismissed(c.key))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={plan.isUnmapped ? plan.context?.unmappedLabel : plan.programName}
        title="Contanos hasta dónde llegaste"
        description="Marcá lo que ya tenés. Después lo podés cambiar materia por materia."
      />

      {plan.isUnmapped ? (
        <p className="border-rule bg-paper-elevated text-ink-muted rounded-lg border border-dashed px-4 py-3 text-sm">
          {manualSubjectsBanner}
        </p>
      ) : null}

      <p className="text-ink-muted -mt-4 text-xs">
        <strong className="text-ink font-medium">Regularizada</strong> es cursada aprobada, con
        el final todavía por rendir.
      </p>

      {plan.byYear.map((group) => {
        const approvable = approveYear(plan.views, group.yearLevel).length
        const approved = group.subjects.filter(
          (s) => s.status === 'passed' || s.status === 'equivalent',
        ).length
        return (
          <section
            key={group.yearLevel}
            aria-labelledby={`anio-${group.yearLevel}`}
            className="flex flex-col gap-2"
          >
            <SectionHeading
              id={`anio-${group.yearLevel}`}
              aside={`${approved} de ${group.subjects.length} aprobadas`}
            >
              {group.yearLevel}° año
            </SectionHeading>

            <div className="flex min-h-11 flex-wrap items-center gap-3">
              {approvable > 0 ? (
                <Button variant="secondary" onClick={() => approve(group.yearLevel)}>
                  Aprobé todo {group.yearLevel}° año
                </Button>
              ) : (
                <p className="text-ink-muted inline-flex items-center gap-1.5 text-sm">
                  <Check aria-hidden="true" className="size-4" />
                  Todo el {group.yearLevel}° año está aprobado
                </p>
              )}
              {undo && undo.yearLevel === group.yearLevel ? (
                <p
                  role="status"
                  className="text-ink-muted flex flex-wrap items-center gap-x-3 text-sm"
                >
                  <span>
                    Marcamos {undo.changes.length}{' '}
                    {undo.changes.length === 1 ? 'materia' : 'materias'} de {group.yearLevel}°
                    año como {undo.changes.length === 1 ? 'aprobada' : 'aprobadas'}.
                  </span>
                  <button
                    type="button"
                    onClick={revert}
                    className="text-accent-ink text-sm font-medium underline underline-offset-4"
                  >
                    Deshacer
                  </button>
                </p>
              ) : null}
            </div>

            <ul>
              {group.subjects.map((subject) => (
                <li
                  key={subject.id}
                  className="border-rule-soft flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-3"
                >
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="text-ink text-sm">{subject.name}</p>
                    <p className="text-ink-muted text-xs">
                      {TERM_LABEL[subject.term]}
                      {subject.elective ? ' · Electiva' : null}
                    </p>
                  </div>
                  <StatusControl
                    subjectName={subject.name}
                    status={subject.status}
                    onChange={(status) => {
                      // A hand edit after "Aprobé todo" makes the old undo unsafe.
                      setUndo(null)
                      return setStatus.mutateAsync(toInput(subject.id, status))
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {setMany.error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {(setMany.error as Error).message}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-3">
        <Button variant="primary" size="lg" onClick={finish}>
          Listo
        </Button>
      </div>

      {done ? (
        conflicts.length === 0 ? (
          <p
            ref={summary as React.RefObject<HTMLParagraphElement | null>}
            tabIndex={-1}
            className="text-ink text-sm outline-none"
          >
            Todo cierra con el plan.{' '}
            <Link to="/plan" className="text-accent-ink underline underline-offset-4">
              Ver tu plan
            </Link>
          </p>
        ) : (
          <section
            ref={summary}
            tabIndex={-1}
            aria-labelledby="para-revisar"
            className="flex flex-col gap-3 outline-none"
          >
            <SectionHeading id="para-revisar">Para revisar</SectionHeading>
            <p className="text-ink text-sm">
              {conflicts.length} {conflicts.length === 1 ? 'materia' : 'materias'} con
              correlativas pendientes
            </p>
            <p className="text-ink-muted text-sm">
              Las dejamos como las marcaste y cuentan en tu avance. Si alguna es una
              equivalencia o una excepción, ignorá el aviso.
            </p>
            <ul className="flex flex-col gap-2">
              {conflicts.map((conflict) => {
                const subject = byId.get(conflict.subjectId)
                if (!subject) return null
                return (
                  <li key={conflict.key} className="border-rule-soft border-b pb-2 text-sm">
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: subject.id }}
                      className="text-ink font-medium underline-offset-4 hover:underline"
                    >
                      {subject.name}
                    </Link>
                    <p className="text-ink-muted">{orderConflictMessage(conflict)}</p>
                  </li>
                )
              })}
            </ul>
            <Link to="/plan" className="text-accent-ink text-sm underline underline-offset-4">
              Ver tu plan
            </Link>
          </section>
        )
      ) : null}
    </div>
  )
}
