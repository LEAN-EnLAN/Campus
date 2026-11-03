import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { ProgressLine } from '@/components/progress-line'
import { StatusGlyph } from '@/components/academic-status'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { Button } from '@/components/ui/button'
import type { AgendaEntry } from '@/domain/agenda'
import type { SubjectView } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems, useCreateAcademicItem } from '@/features/items/queries'
import { useCompleteItem } from '@/features/items/use-complete-item'
import { buildToday, daysLeftLabel } from '@/features/items/today-model'
import { dueTimeLabel } from '@/features/items/due'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function BlueSection({
  id,
  title,
  rows,
  subjectName,
  onComplete,
  overdue = false,
}: {
  id: string
  title: string
  rows: (AgendaEntry & { daysLeft?: number })[]
  subjectName: (id: string | null) => string | null
  onComplete: (entry: AgendaEntry, done: boolean) => void
  overdue?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="blue-section-label">
        {title}
        <span className="blue-count">{rows.length}</span>
      </h2>
      <div className="blue-list">
        {rows.map((entry) => (
          <DeadlineRow
            key={entry.item.id}
            item={entry.item}
            subjectId={entry.item.curriculumSubjectId}
            subjectName={subjectName(entry.item.curriculumSubjectId)}
            overdue={overdue}
            dayLabel={entry.daysLeft === undefined ? undefined : daysLeftLabel(entry.daysLeft)}
            onToggle={(done) => onComplete(entry, done)}
          />
        ))}
      </div>
    </section>
  )
}

function SubjectsPanel({
  title,
  subjects,
}: {
  title: string
  subjects: readonly SubjectView[]
}) {
  if (subjects.length === 0) return null
  return (
    <section className="blue-panel">
      <div className="blue-panel-head">
        <h2>{title}</h2>
        <Link className="blue-text-link" to="/courses">
          Ver todas
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <ul>
        {subjects.slice(0, 5).map((subject) => (
          <li key={subject.id} className="blue-stat-row">
            <StatusGlyph status={subject.status} />
            <Link
              to="/courses/$courseId"
              params={{ courseId: subject.id }}
              className="min-w-0 flex-1 py-2 text-sm break-words"
            >
              {subject.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Approved blue direction, backed by the student's real academic model. */
export function BlueTodayScreen() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const createItem = useCreateAcademicItem()
  const [captureOpen, setCaptureOpen] = useState(false)
  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => buildToday(itemsQuery.data ?? [], now), [itemsQuery.data, now])
  const subjectName = (id: string | null) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null
  const { complete, dialog } = useCompleteItem(subjectName)
  const cursando = plan.views.filter((subject) => subject.status === 'in_progress')
  const finales = plan.views.filter((subject) => subject.status === 'regularized')
  const dueCount = today.today.length + today.overdue.length
  const isLoading = itemsQuery.isLoading || plan.isLoading
  async function handleCapture(values: QuickCaptureValues) {
    try {
      await createItem.mutateAsync(values)
      setCaptureOpen(false)
    } catch {
      // Keep the student's draft open; the mutation error appears in the form.
    }
  }
  function openCapture() {
    if (createItem.isPending) return
    createItem.reset()
    setCaptureOpen(true)
  }
  const renderSection = (
    id: string,
    title: string,
    rows: (AgendaEntry & { daysLeft?: number })[],
    overdue = false,
  ) => (
    <BlueSection
      id={id}
      title={title}
      rows={rows}
      overdue={overdue}
      subjectName={subjectName}
      onComplete={(entry, done) => complete(entry.item, done)}
    />
  )

  return (
    <div className="blue-screen">
      {dialog}
      <header className="blue-screen-head">
        <div>
          <h1 className="blue-screen-title">Hoy</h1>
          <p className="blue-screen-subtitle">
            {dateFormat.format(now).replace(/^./, (c) => c.toUpperCase())}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/calendar" className="blue-button-outline" aria-label="Abrir calendario">
            <CalendarDays aria-hidden="true" className="size-4" />
            <span>Calendario</span>
          </Link>
          <Button variant="primary" onClick={openCapture}>
            <Plus aria-hidden="true" className="size-4" /> Agregar entrega
          </Button>
        </div>
      </header>

      {itemsQuery.error ? (
        <ErrorState
          error={itemsQuery.error as Error}
          onRetry={() => void itemsQuery.refetch()}
        />
      ) : null}
      {isLoading ? (
        <LoadingRows rows={5} />
      ) : itemsQuery.error ? null : (
        <div className="blue-layout blue-layout-wide">
          <div className="grid min-w-0 gap-6">
            <div className="blue-panel-soft blue-dashboard-hero">
              <span className="bg-accent-soft text-accent-ink flex size-11 shrink-0 items-center justify-center rounded-lg">
                {dueCount > 0 ? (
                  <CalendarDays aria-hidden="true" className="size-5" />
                ) : (
                  <Check aria-hidden="true" className="size-5" />
                )}
              </span>
              <div>
                <strong>
                  {dueCount > 0
                    ? `Tenés ${dueCount} ${dueCount === 1 ? 'pendiente' : 'pendientes'} para revisar`
                    : 'No tenés entregas para hoy'}
                </strong>
                <p>
                  {today.overdue.length} {today.overdue.length === 1 ? 'atrasada' : 'atrasadas'}{' '}
                  · {today.today.length} de hoy
                </p>
              </div>
            </div>
            {renderSection('blue-overdue', 'Atrasadas', today.overdue, true)}
            {renderSection('blue-today', 'Hoy', today.today)}
            {renderSection('blue-upcoming', 'Próximas', today.upcoming)}
            {renderSection('blue-undated', 'Sin fecha', today.undated)}
            {dueCount === 0 && today.upcoming.length === 0 && today.undated.length === 0 ? (
              <EmptyState
                quiet
                title="No hay tareas pendientes"
                description="Cuando agregues una fecha o tarea, va a aparecer acá."
                action={
                  <Button variant="secondary" onClick={openCapture}>
                    Agregar mi primera entrega
                  </Button>
                }
              />
            ) : null}
            {plan.hasContext && !plan.isUnmapped && plan.progress.total > 0 ? (
              <section className="blue-panel">
                <div className="blue-panel-head">
                  <h2>Tu progreso académico</h2>
                  <Link className="blue-text-link" to="/plan">
                    Ver plan
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
                <ProgressLine
                  value={plan.progress.passed + plan.progress.equivalent}
                  total={plan.progress.total}
                />
              </section>
            ) : null}
            {plan.error && !plan.hasContext ? (
              <ErrorState
                title="No pudimos cargar tu carrera"
                error={plan.error}
                onRetry={() => window.location.reload()}
              />
            ) : null}
            {!plan.hasContext && !plan.isLoading && !plan.error ? (
              <EmptyState
                title="Todavía no elegiste tu carrera"
                action={
                  <Link to="/onboarding" className="blue-text-link">
                    Elegir mi carrera
                  </Link>
                }
              />
            ) : null}
          </div>

          <aside aria-label="Resumen de Hoy" className="grid min-w-0 content-start gap-4">
            <section className="blue-panel">
              <div className="blue-panel-head">
                <h2>Calendario de hoy</h2>
                {/* 'Abrir', not 'Ver calendario': the rail is 280px and the title
                    already says calendar; the longer label forced a second line. */}
                <Link className="blue-text-link" to="/calendar" aria-label="Abrir calendario">
                  Abrir
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
              {today.today.length > 0 ? (
                <ul>
                  {today.today.map((entry) => (
                    <li key={entry.item.id} className="blue-stat-row">
                      <CalendarDays
                        aria-hidden="true"
                        className="text-accent-ink size-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{entry.item.title}</span>
                        <span className="text-ink-muted block truncate text-xs">
                          {subjectName(entry.item.curriculumSubjectId) ?? 'General'}
                        </span>
                      </span>
                      {dueTimeLabel(entry.item) ? (
                        <span className="blue-stat-time">{dueTimeLabel(entry.item)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ink-muted text-sm">Sin eventos con fecha para hoy.</p>
              )}
            </section>
            <SubjectsPanel title="Mis materias" subjects={cursando} />
            <SubjectsPanel title="Regularizadas (final pendiente)" subjects={finales} />
          </aside>
        </div>
      )}
      <QuickCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        subjects={plan.views}
        items={itemsQuery.data ?? []}
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error instanceof Error ? createItem.error.message : null}
      />
    </div>
  )
}
