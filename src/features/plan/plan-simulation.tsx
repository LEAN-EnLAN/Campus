import { useEffect, useRef, useState } from 'react'

import { statusLabel } from '@/components/academic-status'
import { AcademicYearDisclosure } from '@/components/academic-year-disclosure'
import { StatusControl } from '@/components/status-control'
import { SubjectRow } from '@/components/subject-row'
import { Button } from '@/components/ui/button'
import { filterByTerm, TERM_LABEL, termsInPlan, type TermFilter } from '@/domain/simulation'
import type { SubjectView } from '@/domain/types'
import type { AcademicPlan } from '@/features/academic/queries'

import { usePlanSimulation } from './use-plan-simulation'

/**
 * "¿Qué curso el cuatri que viene?" — the plan with statuses the student only
 * imagines. Same status control as the real plan, wired to memory instead of a
 * mutation; the banner says so before anything else on the screen.
 */
export function PlanSimulation({
  plan,
  onExit,
}: {
  plan: Pick<AcademicPlan, 'views' | 'availabilityInput'>
  onExit: () => void
}) {
  const simulation = usePlanSimulation(plan)
  const [term, setTerm] = useState<TermFilter>('all')
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Entering the mode moves focus to the sentence that explains it.
  useEffect(() => headingRef.current?.focus(), [])

  const terms = termsInPlan(plan.views)
  const { diff, changes } = simulation
  const cursar = filterByTerm(diff.cursar, term)
  const rendir = filterByTerm(diff.rendir, term)
  const closes = filterByTerm(diff.closes, term)
  const anyChange = diff.cursar.length + diff.rendir.length + diff.closes.length > 0
  const anyShown = cursar.length + rendir.length + closes.length > 0

  return (
    <div className="grid min-w-0 gap-5">
      <section
        aria-labelledby="simulacion-titulo"
        className="border-accent bg-accent-soft flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      >
        <div className="min-w-0 flex-1 basis-56">
          <h2
            id="simulacion-titulo"
            ref={headingRef}
            tabIndex={-1}
            className="text-accent-ink text-base font-semibold focus-visible:outline-none"
          >
            Estás simulando: nada se guarda
          </h2>
          <p className="text-ink text-sm">
            Cambiá el estado de las materias como si ya hubiera pasado (apruebo, regularizo) y
            mirá qué se te abre. Al salir, tu plan vuelve a estar como está.
          </p>
        </div>
        <Button variant="primary" onClick={onExit}>
          Salir de la simulación
        </Button>
      </section>

      <section aria-labelledby="simulacion-resultado" className="blue-panel">
        <div className="blue-panel-head">
          <h2 id="simulacion-resultado">¿Qué se te abre?</h2>
        </div>

        {terms.length > 1 && anyChange ? (
          <div
            role="group"
            aria-label="Filtrar por cuatrimestre"
            className="mb-3 flex flex-wrap gap-2"
          >
            {(['all', ...terms] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={term === value ? 'primary' : 'secondary'}
                aria-pressed={term === value}
                onClick={() => setTerm(value)}
              >
                {value === 'all' ? 'Todos' : TERM_LABEL[value]}
              </Button>
            ))}
          </div>
        ) : null}

        <div aria-live="polite" className="grid gap-3 text-sm">
          {changes.length === 0 ? (
            <p className="text-ink-muted">
              Todavía no cambiaste nada. Elegí el estado de una materia abajo para ver qué se te
              habilita.
            </p>
          ) : !anyChange ? (
            <p className="text-ink-muted">
              Con estos cambios no se te abre ninguna materia nueva.
            </p>
          ) : !anyShown ? (
            <p className="text-ink-muted">
              Nada de lo que se te abre es de este cuatrimestre. Probá con “Todos”.
            </p>
          ) : (
            <>
              {cursar.length + rendir.length > 0 ? (
                <p className="text-ink font-medium">Si pasa esto, se te abren:</p>
              ) : null}
              <SubjectList title="Para cursar" subjects={cursar} />
              <SubjectList title="Para rendir el final" subjects={rendir} />
              <SubjectList title="Dejarías de poder cursar" subjects={closes} />
            </>
          )}
        </div>

        {changes.length > 0 ? (
          <div className="border-rule mt-4 grid gap-2 border-t pt-3 text-sm">
            <h3 className="text-ink-muted text-xs font-semibold uppercase">
              Lo que estás suponiendo
            </h3>
            <ul className="grid gap-1">
              {changes.map((change) => (
                <li key={change.subject.id}>
                  {change.subject.name}:{' '}
                  <span className="font-medium">
                    {change.to === null ? 'Sin marcar' : statusLabel(change.to)}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="ghost"
              className="justify-self-start"
              onClick={simulation.reset}
            >
              Deshacer los cambios
            </Button>
          </div>
        ) : null}
      </section>

      {simulation.byYear.map((group) => (
        <AcademicYearDisclosure
          key={group.yearLevel}
          year={group.yearLevel}
          summary={`${group.subjects.length} ${group.subjects.length === 1 ? 'materia' : 'materias'}`}
          initiallyOpen={
            simulation.byYear.find((year) =>
              year.subjects.some((subject) => subject.status === 'in_progress'),
            )?.yearLevel === group.yearLevel
          }
        >
          <ul className="blue-list">
            {group.subjects.map((subject) => (
              <li key={subject.id}>
                <SubjectRow
                  subject={subject}
                  control={
                    <StatusControl
                      subjectName={subject.name}
                      status={subject.status}
                      variant="compact"
                      savedLabel="Simulado, sin guardar"
                      onChange={(status) => simulation.imagine(subject.id, status)}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        </AcademicYearDisclosure>
      ))}
    </div>
  )
}

function SubjectList({ title, subjects }: { title: string; subjects: readonly SubjectView[] }) {
  if (subjects.length === 0) return null
  return (
    <div className="grid gap-1">
      <h3 className="text-ink-muted text-xs font-semibold uppercase">{title}</h3>
      <ul className="grid gap-1">
        {subjects.map((subject) => (
          <li key={subject.id} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-ink font-medium">{subject.name}</span>
            <span className="text-ink-muted text-xs" data-numeric>
              {subject.yearLevel}° año · {TERM_LABEL[subject.term]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
