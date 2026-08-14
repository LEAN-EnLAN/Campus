import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { SubjectRow } from '@/components/subject-row'
import { Button } from '@/components/ui/button'
import type { SubjectStatus } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'

export const Route = createFileRoute('/_app/courses/')({
  component: CoursesScreen,
})

type Filter = 'cursando' | 'disponibles' | 'aprobadas' | 'todas'

const FILTERS: { value: Filter; label: string; match: (s: SubjectStatus) => boolean }[] = [
  {
    value: 'cursando',
    label: 'Cursando',
    match: (s) => s === 'in_progress' || s === 'regularized',
  },
  { value: 'disponibles', label: 'Disponibles', match: (s) => s === 'available' },
  {
    value: 'aprobadas',
    label: 'Aprobadas',
    match: (s) => s === 'passed' || s === 'equivalent',
  },
  { value: 'todas', label: 'Todas', match: () => true },
]

function CoursesScreen() {
  const plan = useAcademicPlan()
  const [filter, setFilter] = useState<Filter>('cursando')

  const spec = FILTERS.find((f) => f.value === filter) ?? FILTERS[3]!
  const counts = useMemo(() => {
    const map = new Map<Filter, number>()
    for (const f of FILTERS)
      map.set(f.value, plan.views.filter((v) => f.match(v.status)).length)
    return map
  }, [plan.views])

  const visible = useMemo(
    () => plan.views.filter((v) => spec.match(v.status)),
    [plan.views, spec],
  )

  if (plan.isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tus materias" />
        <LoadingRows rows={6} />
      </div>
    )
  }

  if (plan.error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tus materias" />
        <ErrorState error={plan.error} />
      </div>
    )
  }

  if (!plan.hasContext || plan.isUnmapped) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tus materias" />
        <EmptyState
          title={
            plan.isUnmapped
              ? 'Todavía no tenemos tu plan de estudios'
              : 'Todavía no elegiste tu carrera'
          }
          description={
            plan.isUnmapped
              ? 'Cuando tengamos tu plan verificado vas a ver acá todas tus materias.'
              : 'Elegí universidad, facultad, carrera y plan para ver tus materias.'
          }
          action={
            <Link
              to="/onboarding"
              className="text-accent text-sm font-medium underline-offset-4 hover:underline"
            >
              {plan.isUnmapped ? 'Cambiar mi carrera' : 'Elegir mi carrera'}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={plan.curriculum?.version}
        title="Tus materias"
        description="Marcá en qué estás y Campus recalcula qué se te habilita."
      />

      <div role="group" aria-label="Filtrar materias" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? 'primary' : 'secondary'}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {/* No opacity at all. opacity-70 composited to 3.84:1 and failed; 90%
                measured ~5.3:1 yet still tripped axe at 390px, which means it was
                sitting close enough to the threshold to be decided by rounding.
                A value that passes at four viewports out of five is not passing. */}
            <span className="text-xs" data-numeric>
              {counts.get(f.value) ?? 0}
            </span>
          </Button>
        ))}
      </div>

      <section aria-labelledby="listado" className="flex flex-col gap-1">
        <SectionHeading id="listado">{spec.label}</SectionHeading>
        {visible.length === 0 ? (
          <EmptyState
            className="mt-2"
            title={
              filter === 'cursando' ? 'No estás cursando nada todavía' : 'No hay materias acá'
            }
            description={
              filter === 'cursando'
                ? 'Abrí una materia desde tu plan y marcala como "Cursando" para que aparezca en Hoy.'
                : undefined
            }
            action={
              filter === 'cursando' ? (
                <Link
                  to="/plan"
                  className="text-accent text-sm font-medium underline-offset-4 hover:underline"
                >
                  Ver tu plan
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {visible.map((subject) => (
              <li key={subject.id}>
                <SubjectRow subject={subject} showYear />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
