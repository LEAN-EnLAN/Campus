import { createFileRoute, Link } from '@tanstack/react-router'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { ProgressLine } from '@/components/progress-line'
import { SubjectRow } from '@/components/subject-row'
import { useAcademicPlan } from '@/features/academic/queries'

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
              className="text-accent text-sm font-medium underline-offset-4 hover:underline"
            >
              Elegir mi carrera
            </Link>
          }
        />
      </div>
    )
  }

  // CAP-ONBOARD-002 — an honest gap, not an empty grid pretending to be a plan.
  if (plan.isUnmapped) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tu plan" eyebrow={plan.context?.unmappedLabel ?? undefined} />
        <EmptyState
          title="Todavía no tenemos tu plan de estudios"
          description="Anotamos que falta. Mientras tanto podés usar Hoy, el calendario y el material sin problema — no vamos a inventar materias ni correlativas que no pudimos verificar."
          action={
            <Link
              to="/onboarding"
              className="text-accent text-sm font-medium underline-offset-4 hover:underline"
            >
              Cambiar mi carrera
            </Link>
          }
        />
      </div>
    )
  }

  const earned = plan.progress.passed + plan.progress.equivalent

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={plan.curriculum?.version} title={plan.programName ?? 'Tu plan'} />

      <ProgressLine value={earned} total={plan.progress.total} />

      {plan.progress.blocked > 0 ? (
        <p className="text-ink-muted text-sm">
          {plan.progress.available} disponible{plan.progress.available === 1 ? '' : 's'} ·{' '}
          {plan.progress.blocked} bloqueada{plan.progress.blocked === 1 ? '' : 's'} por
          correlativas
        </p>
      ) : null}

      {/* Silence here would read as "nada te bloquea", which is a claim we cannot make.
          A plan with no correlativa graph has to say so, or Campus is quietly asserting
          an academic fact it does not have (P-05). */}
      {plan.prerequisiteCount === 0 && plan.views.length > 0 ? (
        <p className="border-rule bg-paper-elevated text-ink-muted rounded-lg border border-dashed px-4 py-3 text-sm">
          Esta facultad todavía no publicó las correlatividades de este plan, así que Campus no
          puede decirte qué te habilita cada materia. Cuando salgan, las cargamos.{' '}
          <span className="text-ink">No las inventamos.</span>
        </p>
      ) : null}

      {plan.byYear.map((group) => (
        <section
          key={group.yearLevel}
          aria-labelledby={`anio-${group.yearLevel}`}
          className="flex flex-col gap-1"
        >
          <SectionHeading
            id={`anio-${group.yearLevel}`}
            aside={`${group.subjects.length} materias`}
          >
            {group.yearLevel}° año
          </SectionHeading>
          <ul>
            {group.subjects.map((subject) => (
              <li key={subject.id}>
                <SubjectRow subject={subject} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {plan.curriculum?.sourceUrl ? (
        <footer className="border-rule-soft text-ink-muted border-t pt-4 text-xs">
          {plan.curriculum?.name ? `${plan.curriculum.name}. ` : null}
          Plan tomado de{' '}
          <a
            href={plan.curriculum.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline underline-offset-4"
          >
            la fuente oficial
          </a>
          {plan.curriculum.sourceFetchedAt
            ? ` · consultado el ${new Date(plan.curriculum.sourceFetchedAt).toLocaleDateString('es-AR')}`
            : null}
          .
        </footer>
      ) : null}
    </div>
  )
}
