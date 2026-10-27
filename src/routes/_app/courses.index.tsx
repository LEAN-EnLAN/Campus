import { createFileRoute, Link } from '@tanstack/react-router'
import { Columns3, List, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { SubjectRow } from '@/components/subject-row'
import { Button } from '@/components/ui/button'
import {
  AddManualSubjectForm,
  RemoveManualSubjectButton,
  manualSubjectsBanner,
} from '@/features/academic/manual-subjects'
import { SubjectStatusControl } from '@/features/academic/subject-status-control'
import {
  STATUS_GROUPS,
  defaultStatusFilter,
  groupByStatus,
  statusGroupOf,
  type StatusGroupId,
} from '@/domain/status-groups'
import type { SubjectView } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { SubjectBoardView } from '@/features/courses/subject-board-view'

function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR')
}

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
  const [query, setQuery] = useState('')
  // Subjects whose status the student changed while on this filter. They stay in
  // place until the filter changes: a row that vanishes the moment it is marked
  // takes its "Guardado" with it, and looks like the tap did nothing.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set())

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
      (filter === 'todas'
        ? plan.views
        : plan.views.filter((v) => statusGroupOf(v.status) === filter || pinned.has(v.id))
      ).filter((v) => searchKey(v.name).includes(searchKey(query.trim()))),
    [plan.views, filter, pinned, query],
  )
  // A board has no status filter, but it does share the visible search field.
  // The dragged cards retain their real IDs and mutations through this filtered view.
  const boardSubjects = useMemo(
    () => plan.views.filter((v) => searchKey(v.name).includes(searchKey(query.trim()))),
    [plan.views, query],
  )

  function chooseFilter(next: Filter) {
    setChosen(next)
    setPinned(new Set())
  }

  /** A status was changed in the list: freeze the filter and the row where they are. */
  function keepInPlace(changed: SubjectView) {
    setChosen((current) => current ?? filter)
    setPinned((current) => new Set(current).add(changed.id))
  }

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

  if (!plan.hasContext) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Tus materias" />
        <EmptyState
          title="Todavía no elegiste tu carrera"
          description="Elegí universidad, facultad, carrera y plan para ver tus materias."
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

  return (
    <div className="blue-screen">
      <PageHeader
        eyebrow={
          plan.isUnmapped
            ? plan.context?.unmappedLabel
            : (plan.programName ?? plan.curriculum?.version)
        }
        title="Materias"
        description={
          plan.isUnmapped
            ? manualSubjectsBanner
            : (plan.curriculum?.version ?? 'Tu recorrido académico')
        }
      />
      <div className="blue-layout">
        <div className="grid min-w-0 gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="border-rule bg-paper-elevated flex min-w-[190px] flex-1 items-center gap-2 rounded-lg border px-3">
              <Search aria-hidden="true" className="text-ink-muted size-4" />
              <span className="sr-only">Buscar materias</span>
              <input
                className="min-h-10 w-full min-w-0 bg-transparent text-sm outline-none"
                type="search"
                placeholder="Buscar materias…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {/* The board shows every column at once, so status chips would only
            contradict it (a pressed chip over a board that ignores it). */}
            {showBoard ? (
              <div className="hidden" />
            ) : (
              <div
                role="group"
                aria-label="Filtrar materias"
                className="flex flex-wrap gap-1.5"
              >
                {filters.map((f) => (
                  <Button
                    key={f.value}
                    size="sm"
                    variant={filter === f.value ? 'primary' : 'secondary'}
                    aria-pressed={filter === f.value}
                    onClick={() => chooseFilter(f.value)}
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

          <section aria-labelledby="listado" className="flex min-w-0 flex-col gap-1">
            <SectionHeading id="listado">{showBoard ? 'Tablero' : spec.label}</SectionHeading>
            {showBoard ? (
              <div className="mt-2 min-w-0 overflow-x-auto">
                <SubjectBoardView subjects={boardSubjects} />
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                className="mt-2"
                title={
                  plan.isUnmapped && plan.views.length === 0
                    ? 'Todavía no cargaste materias'
                    : filter === 'cursando'
                      ? 'No estás cursando nada todavía'
                      : filter === 'final_pendiente'
                        ? 'No tenés finales pendientes'
                        : 'No hay materias acá'
                }
                description={
                  plan.isUnmapped && plan.views.length === 0
                    ? 'Agregalas más abajo y marcá en qué estás.'
                    : filter === 'cursando'
                      ? 'Pasá a "Todas" y marcá una materia como "Cursando" para que aparezca en Hoy, o cargá todo tu avance de una.'
                      : undefined
                }
                action={
                  filter === 'cursando' && plan.views.length > 0 ? (
                    <Link
                      to="/plan/progress"
                      className="text-accent-ink text-sm font-medium underline-offset-4 hover:underline"
                    >
                      Cargar mi avance
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="blue-list">
                {visible.map((subject) => (
                  <li key={subject.id}>
                    <SubjectRow
                      subject={subject}
                      showYear
                      control={
                        <span className="flex items-center gap-1">
                          <SubjectStatusControl subject={subject} onChange={keepInPlace} />
                          {subject.manual ? (
                            <RemoveManualSubjectButton subject={subject} />
                          ) : null}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {plan.isUnmapped ? (
            <section aria-labelledby="agregar-materia" className="flex flex-col gap-3">
              <SectionHeading id="agregar-materia">Agregar una materia</SectionHeading>
              <AddManualSubjectForm />
            </section>
          ) : null}
        </div>
        <aside aria-label="Resumen de materias" className="grid min-w-0 content-start gap-4">
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Resumen de materias</h2>
              <Link to="/plan" className="blue-text-link">
                Ver plan →
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-[10px] border-blue-100 text-xl font-bold text-blue-800">
                {plan.progress.total
                  ? Math.round(
                      ((plan.progress.passed + plan.progress.equivalent) /
                        plan.progress.total) *
                        100,
                    )
                  : 0}
                %
              </div>
              <div className="min-w-0 flex-1">
                {STATUS_GROUPS.map((group) => (
                  <div key={group.id} className="blue-stat-row">
                    <span
                      className="blue-status-dot"
                      data-status={
                        group.id === 'aprobadas'
                          ? 'passed'
                          : group.id === 'final_pendiente'
                            ? 'regularized'
                            : group.id === 'disponibles'
                              ? 'available'
                              : 'in_progress'
                      }
                    />{' '}
                    <strong>{groups[group.id].length}</strong>{' '}
                    <span className="truncate">{group.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-ink-muted mt-2 text-xs">Total: {plan.progress.total} materias</p>
          </section>
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Estado actual</h2>
            </div>
            <div className="blue-stat-row">
              <span className="blue-status-dot" />
              {groups.cursando.length} materias cursando
            </div>
            <div className="blue-stat-row">
              <span className="blue-status-dot" data-status="regularized" />
              {groups.final_pendiente.length} finales pendientes
            </div>
            {plan.prerequisitesKnown ? (
              <div className="blue-stat-row">
                <span className="blue-status-dot" data-status="available" />
                {groups.disponibles.length} disponibles
              </div>
            ) : (
              <p className="text-ink-muted mt-2 text-xs">
                Las correlativas no se muestran como disponibles sin información oficial.
              </p>
            )}
          </section>
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Continuá tu recorrido</h2>
            </div>
            <Link to="/plan/progress" className="blue-text-link">
              Actualizar avance académico →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
