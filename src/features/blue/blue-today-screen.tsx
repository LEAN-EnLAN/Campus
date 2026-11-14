import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarDays, Check, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { ProgressLine } from '@/components/progress-line'
import { StatusGlyph } from '@/components/academic-status'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { Button } from '@/components/ui/button'
import { Illustration } from '@/components/ui/illustration'
import type { AgendaEntry } from '@/domain/agenda'
import type { AcademicItem, SubjectView } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems, useCreateAcademicItem } from '@/features/items/queries'
import { useCompleteItem } from '@/features/items/use-complete-item'
import { useItemActions } from '@/features/items/use-item-actions'
import { useSharedCapture } from '@/features/items/use-shared-capture'
import {
  buildToday,
  daysLeftLabel,
  laterLine,
  todayHeadline,
  UPCOMING_DAYS,
} from '@/features/items/today-model'
import { dueTimeLabel } from '@/features/items/due'
import { PENDING_FINALS_ID } from '@/features/plan/pending-finals-model'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

interface RowsProps {
  rows: (AgendaEntry & { daysLeft?: number })[]
  subjectName: (id: string | null) => string | null
  onComplete: (entry: AgendaEntry, done: boolean) => void
  onShare: (item: AcademicItem) => void
  onDownloadIcs: (item: AcademicItem) => void
  isCompleting: (id: string) => boolean
  onEdit: (item: AcademicItem) => void
  onDelete: (item: AcademicItem) => void
  overdue?: boolean
}

function BlueRows({
  rows,
  subjectName,
  onComplete,
  onShare,
  onDownloadIcs,
  isCompleting,
  onEdit,
  onDelete,
  overdue = false,
}: RowsProps) {
  return (
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
          onShare={() => onShare(entry.item)}
          onDownloadIcs={() => onDownloadIcs(entry.item)}
          togglePending={isCompleting(entry.item.id)}
          onEdit={() => onEdit(entry.item)}
          onDelete={() => onDelete(entry.item)}
        />
      ))}
    </div>
  )
}

function BlueSection({ id, title, ...rows }: RowsProps & { id: string; title: string }) {
  if (rows.rows.length === 0) return null
  return (
    <section aria-labelledby={id}>
      {/* Focusable so "Ver próximas" can land the student here, not just scroll. */}
      <h2 id={id} tabIndex={-1} className="blue-section-label">
        {title}
        <span className="blue-count">{rows.rows.length}</span>
      </h2>
      <BlueRows {...rows} />
    </section>
  )
}

/**
 * Everything past the 14-day window, folded into one line that names the next
 * one. Hoy stays about the next two weeks, and nothing open is ever hidden.
 */
function LaterSection({
  id,
  summary,
  open,
  onOpenChange,
  ...rows
}: RowsProps & {
  id: string
  summary: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <section aria-labelledby={id}>
      <details open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
        <summary
          id={id}
          className="text-ink-muted hover:text-ink min-h-11 cursor-pointer py-2 text-sm"
        >
          {summary}
        </summary>
        <BlueRows {...rows} />
      </details>
    </section>
  )
}

function SubjectsPanel({
  title,
  subjects,
  link,
}: {
  title: string
  subjects: readonly SubjectView[]
  /** Where "Ver todas" goes; the subjects list by default. */
  link?: ReactNode
}) {
  if (subjects.length === 0) return null
  return (
    <section className="blue-panel">
      <div className="blue-panel-head">
        <h2>{title}</h2>
        {link ?? (
          <Link className="blue-text-link" to="/courses">
            Ver todas
            <ArrowRight aria-hidden="true" />
          </Link>
        )}
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
  const { complete, isPending: isCompleting, dialog } = useCompleteItem(subjectName)
  const actions = useItemActions({ subjects: plan.views, items: itemsQuery.data ?? [] })
  // A link someone shared (`/add`) opens the capture form here, prefilled.
  const shared = useSharedCapture({
    subjects: plan.views,
    ready: !plan.isLoading && plan.hasContext,
  })
  const cursando = plan.views.filter((subject) => subject.status === 'in_progress')
  const finales = plan.views.filter((subject) => subject.status === 'regularized')
  const dueCount = today.today.length + today.overdue.length
  const isLoading = itemsQuery.isLoading || plan.isLoading
  // "Nothing pending" means NOTHING open, anywhere — not "nothing in the next
  // two weeks". A final in three weeks used to get "Agregar mi primera entrega".
  const nothingPending = today.openCount === 0
  const [laterOpen, setLaterOpen] = useState(false)
  const quietDay =
    dueCount === 0
      ? todayHeadline({
          dueToday: 0,
          upcoming: today.next
            ? [{ title: today.next.item.title, daysLeft: today.next.daysLeft }]
            : [],
          undated: today.undated.length,
        })
      : null
  const nextLater = today.next !== null && today.next.daysLeft > UPCOMING_DAYS
  const later = laterLine(today.later, subjectName)

  /** "Ver próximas": scroll to where the next item is listed and move focus there. */
  function showNext() {
    if (nextLater) setLaterOpen(true)
    const target = document.getElementById(nextLater ? 'blue-later' : 'blue-upcoming')
    target?.scrollIntoView?.({ block: 'start' })
    target?.focus()
  }
  async function handleCapture(values: QuickCaptureValues) {
    try {
      await createItem.mutateAsync(values)
      setCaptureOpen(false)
      if (shared.open) shared.saved()
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
      onShare={(item) => void actions.share(item)}
      onDownloadIcs={actions.downloadIcs}
      isCompleting={isCompleting}
      onEdit={actions.edit}
      onDelete={actions.remove}
    />
  )

  return (
    <div className="blue-screen">
      {dialog}
      {actions.dialogs}
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
              {quietDay && !nothingPending ? (
                <div>
                  <strong>{quietDay.title}</strong>
                  {quietDay.description ? <p>{quietDay.description}</p> : null}
                  {today.next ? (
                    <Button variant="link" size="sm" className="h-auto px-0" onClick={showNext}>
                      {nextLater ? 'Ver más adelante' : 'Ver próximas'}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div>
                  <strong>
                    {dueCount > 0
                      ? `Tenés ${dueCount} ${dueCount === 1 ? 'pendiente' : 'pendientes'} para revisar`
                      : 'No tenés entregas para hoy'}
                  </strong>
                  <p>
                    {today.overdue.length}{' '}
                    {today.overdue.length === 1 ? 'atrasada' : 'atrasadas'} ·{' '}
                    {today.today.length} de hoy
                  </p>
                </div>
              )}
              {/* One spot per screen: with nothing pending the empty state below carries it. */}
              {nothingPending ? null : (
                // Below 400px the drawing squeezed the sentence into a 4-word column.
                <Illustration
                  name="today-study"
                  decorative
                  eager
                  size="xs"
                  className="ml-auto w-24 shrink-0 max-[399px]:hidden sm:w-28"
                />
              )}
            </div>
            {renderSection('blue-overdue', 'Atrasadas', today.overdue, true)}
            {renderSection('blue-today', 'Hoy', today.today)}
            {renderSection('blue-upcoming', 'Próximas', today.upcoming)}
            {later ? (
              <LaterSection
                id="blue-later"
                summary={later}
                open={laterOpen}
                onOpenChange={setLaterOpen}
                rows={today.later}
                subjectName={subjectName}
                onComplete={(entry, done) => complete(entry.item, done)}
                onShare={(item) => void actions.share(item)}
                onDownloadIcs={actions.downloadIcs}
                isCompleting={isCompleting}
                onEdit={actions.edit}
                onDelete={actions.remove}
              />
            ) : null}
            {renderSection('blue-undated', 'Sin fecha', today.undated)}
            {nothingPending ? (
              <EmptyState
                quiet
                illustration={plan.hasContext ? 'today-empty' : undefined}
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
                illustration="plan-unselected"
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
            <SubjectsPanel
              title="Regularizadas (final pendiente)"
              subjects={finales}
              link={
                <Link className="blue-text-link" to="/plan" hash={PENDING_FINALS_ID}>
                  Finales pendientes
                  <ArrowRight aria-hidden="true" />
                </Link>
              }
            />
          </aside>
        </div>
      )}
      <QuickCapture
        open={captureOpen || shared.open}
        onOpenChange={(open) => {
          setCaptureOpen(open)
          if (!open) shared.dismiss()
        }}
        initialValues={shared.initialValues}
        subjects={plan.views}
        items={itemsQuery.data ?? []}
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error instanceof Error ? createItem.error.message : null}
      />
    </div>
  )
}
