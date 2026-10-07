import { createFileRoute, Link } from '@tanstack/react-router'
import { Columns3, List } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { SubjectRow } from '@/components/subject-row'
import { Button } from '@/components/ui/button'
import {
  STATUS_GROUPS,
  defaultStatusFilter,
  groupByStatus,
  statusGroupOf,
  type StatusGroupId,
} from '@/domain/status-groups'
import { useAcademicPlan } from '@/features/academic/queries'
import { SubjectBoardView } from '@/features/courses/subject-board-view'

export const Route = createFileRoute('/_app/courses/')({
  component: CoursesScreen,
})

type Filter = StatusGroupId | 'todas'
type View = 'list' | 'board'

const FILTERS: { value: Filter; label: string }[] = [
  ...STATUS_GROUPS.map((g) => ({ value: g.id as Filter, label: g.label })),
  { value: 'todas', label: 'Todas' },
]

function CoursesScreen() {
  const plan = useAcademicPlan()
  const [chosen, setChosen] = useState<Filter | null>(null)
  const [view, setView] = useState<View>('list')

  const groups = useMemo(() => groupByStatus(plan.views), [plan.views])
  const counts = useMemo(() => {
    const map = new Map<Filter, number>(
      STATUS_GROUPS.map((g) => [g.id, groups[g.id].length] as const),
    )
    map.set('todas', plan.views.length)
    return map
  }, [groups, plan.views.length])

  // "Disponible" is a claim about correlativas. With none published, the chip would
  // be a promise we cannot keep, so it is not offered at all.
  const filters = FILTERS.filter((f) => f.value !== 'disponibles' || plan.prerequisitesKnown)

  // The student's own choice wins; until they make one, open on the first group
  // that has something in it (never an empty list).
  const filter: Filter =
    chosen ??
    defaultStatusFilter(
      {
        disponibles: groups.disponibles.length,
        cursando: groups.cursando.length,
        final_pendiente: groups.final_pendiente.length,
        aprobadas: groups.aprobadas.length,
      },
      plan.prerequisitesKnown,
    )

  const spec = filters.find((f) => f.value === filter) ?? FILTERS[FILTERS.length - 1]!
  const showBoard = view === 'board'

  const visible = useMemo(
    () =>
      filter === 'todas'
        ? plan.views
        : plan.views.filter((v) => statusGroupOf(v.status) === filter),
    [plan.views, filter],
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
              className="text-accent-ink text-sm font-medium underline-offset-4 hover:underline"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* The board shows every column at once, so status chips would only
            contradict it (a pressed chip over a board that ignores it). */}
        {showBoard ? (
          <div />
        ) : (
          <div role="group" aria-label="Filtrar materias" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={filter === f.value ? 'primary' : 'secondary'}
                aria-pressed={filter === f.value}
                onClick={() => setChosen(f.value)}
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
        )}

        <div role="group" aria-label="Cómo ver tus materias" className="flex gap-1.5">
          <Button
            size="sm"
            variant={view === 'list' ? 'primary' : 'secondary'}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <List aria-hidden="true" />
            Lista
          </Button>
          <Button
            size="sm"
            variant={view === 'board' ? 'primary' : 'secondary'}
            aria-pressed={view === 'board'}
            onClick={() => setView('board')}
          >
            <Columns3 aria-hidden="true" />
            Tablero
          </Button>
        </div>
      </div>

      <section aria-labelledby="listado" className="flex flex-col gap-1">
        <SectionHeading id="listado">{showBoard ? 'Tablero' : spec.label}</SectionHeading>
        {showBoard ? (
          <div className="mt-2">
            <SubjectBoardView />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            className="mt-2"
            title={
              filter === 'cursando'
                ? 'No estás cursando nada todavía'
                : filter === 'final_pendiente'
                  ? 'No tenés finales pendientes'
                  : 'No hay materias acá'
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
                  className="text-accent-ink text-sm font-medium underline-offset-4 hover:underline"
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
