import { createFileRoute, Link } from '@tanstack/react-router'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { ProgressLine } from '@/components/progress-line'
import { SubjectRow } from '@/components/subject-row'
import { buttonVariants } from '@/components/ui/button'
import {
  AddManualSubjectForm,
  RemoveManualSubjectButton,
  manualSubjectsBanner,
} from '@/features/academic/manual-subjects'
import { useAcademicPlan } from '@/features/academic/queries'
import { SubjectStatusControl } from '@/features/academic/subject-status-control'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/plan')({
  component: PlanScreen,
})

/**
 * CAP-PLAN-001 — the plan grouped by year.
 *
 * Note what this component does NOT do: it never computes availability. Every
 * status here arrives already resolved from `src/domain/availability.ts`.
 */
function PlanScreen() {
  const plan = useAcademicPlan()

  if (plan.isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tu plan" />
        <LoadingRows rows={8} />
      </div>
    )
  }

  if (plan.error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tu plan" />
        <ErrorState error={plan.error} />
      </div>
    )
  }

  if (!plan.hasContext) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tu plan" />
        <EmptyState
          title="Todavía no elegiste tu carrera"
          description="Elegí universidad, facultad, carrera y plan para ver tus materias y correlativas."
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

  // CAP-ONBOARD-002 — a carrera that is not in Campus. The student builds their own
  // list; Campus keeps what they say and claims nothing else (no availability, no
  // correlativas, no "te falta").
  if (plan.isUnmapped) {
    const manualEarned = plan.progress.passed + plan.progress.equivalent
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow={plan.context?.unmappedLabel ?? undefined}
          title="Tu plan"
          actions={
            plan.views.length > 0 ? (
              <Link
                to="/plan/progress"
                className={cn(buttonVariants({ variant: 'secondary' }))}
              >
                Cargar mi avance
              </Link>
            ) : undefined
          }
        />

        <p className="border-rule bg-paper-elevated text-ink-muted -mt-4 rounded-lg border border-dashed px-4 py-3 text-sm">
          {manualSubjectsBanner}{' '}
          <Link
            to="/onboarding"
            className="text-accent-ink font-medium underline underline-offset-4"
          >
            Cambiar mi carrera
          </Link>
        </p>

        {plan.views.length > 0 ? (
          <ProgressLine
            value={manualEarned}
            total={plan.progress.total}
            label="materias que cargaste"
          />
        ) : null}

        {plan.byYear.map((group) => (
          <section
            key={group.yearLevel}
            aria-labelledby={`anio-${group.yearLevel}`}
            className="flex flex-col gap-1"
          >
            <SectionHeading
              id={`anio-${group.yearLevel}`}
              aside={`${group.subjects.length} ${group.subjects.length === 1 ? 'materia' : 'materias'}`}
            >
              {group.yearLevel}° año
            </SectionHeading>
            <ul>
              {group.subjects.map((subject) => (
                <li key={subject.id}>
                  <SubjectRow
                    subject={subject}
                    control={
                      <span className="flex items-center gap-1">
                        <SubjectStatusControl subject={subject} />
                        <RemoveManualSubjectButton subject={subject} />
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="agregar-materia" className="flex flex-col gap-3">
          <SectionHeading id="agregar-materia">Agregar una materia</SectionHeading>
          {plan.views.length === 0 ? (
            <EmptyState
              quiet
              title="Todavía no cargaste ninguna materia. Agregá la primera y después marcá en qué estás."
            />
          ) : null}
          <AddManualSubjectForm />
        </section>
      </div>
    )
  }

  const earned = plan.progress.passed + plan.progress.equivalent

  return (
    <div className="blue-screen">
      <PageHeader
        eyebrow={plan.curriculum?.version}
        title="Plan académico"
        description={plan.programName ?? 'Tu carrera'}
        actions={
          <Link to="/plan/progress" className={cn(buttonVariants({ variant: 'secondary' }))}>
            Cargar mi avance
          </Link>
        }
      />

      {/* Where this plan comes from and when we read it, before the student relies on
          it to decide an enrolment. Same data as ever: ordinance, official source, date. */}
      {plan.curriculum?.sourceUrl ? (
        <p className="text-ink-muted -mt-4 text-xs">
          {plan.curriculum?.name ? `${plan.curriculum.name}. ` : null}
          Plan tomado de{' '}
          <a
            href={plan.curriculum.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent-ink underline underline-offset-4"
          >
            la fuente oficial
          </a>
          {plan.curriculum.sourceFetchedAt
            ? ` · consultado el ${new Date(plan.curriculum.sourceFetchedAt).toLocaleDateString('es-AR')}`
            : null}
          .
        </p>
      ) : null}

      <div className="blue-layout">
        <div className="grid min-w-0 gap-5">
          <div className="blue-panel-soft">
            <div className="blue-panel-head">
              <h2>Tu progreso en la carrera</h2>
              <span className="blue-chip">
                {plan.progress.total ? Math.round((earned / plan.progress.total) * 100) : 0}%
                completado
              </span>
            </div>
            <ProgressLine value={earned} total={plan.progress.total} />
          </div>

          {plan.progress.flagged > 0 ? (
            <p className="text-ink-muted -mt-6 text-xs">
              {plan.progress.flagged} con correlativas pendientes
            </p>
          ) : null}

          {plan.prerequisitesKnown && plan.progress.blocked > 0 ? (
            <p className="text-ink-muted text-sm">
              {plan.progress.available} disponible{plan.progress.available === 1 ? '' : 's'} ·{' '}
              {plan.progress.blocked} bloqueada{plan.progress.blocked === 1 ? '' : 's'} por
              correlativas
            </p>
          ) : null}

          {/* Silence here would read as "nada te bloquea", which is a claim we cannot make.
          A plan with no correlativa graph has to say so, or Campus is quietly asserting
          an academic fact it does not have (P-05). */}
          {!plan.prerequisitesKnown && plan.views.length > 0 ? (
            <p className="border-rule bg-paper-elevated text-ink-muted rounded-lg border border-dashed px-4 py-3 text-sm">
              Esta facultad todavía no publicó las correlatividades de este plan, así que Campus
              no puede decirte qué te habilita cada materia. Cuando salgan, las cargamos.{' '}
              <span className="text-ink">No las inventamos.</span>
            </p>
          ) : null}

          {plan.byYear.map((group) => (
            <section
              key={group.yearLevel}
              aria-labelledby={`anio-${group.yearLevel}`}
              className="blue-panel flex flex-col gap-2"
            >
              <SectionHeading
                id={`anio-${group.yearLevel}`}
                aside={`${group.subjects.length} materias`}
              >
                {group.yearLevel}° año
              </SectionHeading>
              <ul className="blue-list">
                {group.subjects.map((subject) => (
                  <li key={subject.id}>
                    <SubjectRow subject={subject} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <aside aria-label="Resumen del plan" className="grid min-w-0 content-start gap-4">
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Tu avance</h2>
            </div>
            <div className="flex items-center justify-center py-4">
              <div className="flex size-32 items-center justify-center rounded-full border-[12px] border-blue-100 text-center">
                <div>
                  <strong className="block text-3xl text-blue-800">
                    {plan.progress.total ? Math.round((earned / plan.progress.total) * 100) : 0}
                    %
                  </strong>
                  <span className="text-ink-muted text-xs">completado</span>
                </div>
              </div>
            </div>
            <p className="text-ink-muted text-center text-sm">
              {earned} de {plan.progress.total} materias aprobadas o equivalentes
            </p>
            <div className="blue-stat-row">
              <span className="blue-status-dot" data-status="passed" />
              Aprobadas y equivalentes<strong className="ml-auto">{earned}</strong>
            </div>
            <div className="blue-stat-row">
              <span className="blue-status-dot" />
              Cursando
              <strong className="ml-auto">
                {plan.views.filter((v) => v.status === 'in_progress').length}
              </strong>
            </div>
            <div className="blue-stat-row">
              <span className="blue-status-dot" data-status="regularized" />
              Final pendiente
              <strong className="ml-auto">
                {plan.views.filter((v) => v.status === 'regularized').length}
              </strong>
            </div>
          </section>
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Correlativas</h2>
            </div>
            <p className="text-ink-muted text-sm">
              {plan.prerequisitesKnown
                ? `Campus muestra ${plan.progress.available} materias disponibles según las correlativas registradas.`
                : 'Todavía no tenemos información oficial suficiente para afirmar qué materias tenés habilitadas.'}
            </p>
          </section>
          <Link to="/plan/progress" className="blue-button justify-center">
            Actualizar avance
          </Link>
        </aside>
      </div>
    </div>
  )
}
