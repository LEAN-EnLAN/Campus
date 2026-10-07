import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { ProgressLine } from '@/components/progress-line'
import { StatusGlyph } from '@/components/academic-status'
import type { AgendaEntry } from '@/domain/agenda'
import type { SubjectView } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems } from '@/features/items/queries'
import { useCompleteItem } from '@/features/items/use-complete-item'
import { buildToday, daysLeftLabel, todayHeadline } from '@/features/items/today-model'

export const Route = createFileRoute('/_app/today')({
  component: TodayScreen,
})

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const SHORT_DATE = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })

/** "Mañana", "En 10 días (17 de octubre)" — how a person says when. */
function whenLabel(entry: AgendaEntry & { daysLeft?: number }): string | null {
  if (entry.daysLeft === undefined) return null
  const anchor = entry.item.dueAt ?? entry.item.startsAt
  const date = anchor ? new Date(anchor) : null
  const base = daysLeftLabel(entry.daysLeft)
  if (!date || Number.isNaN(date.getTime()) || entry.daysLeft === 1) return base
  return `${base} (${SHORT_DATE.format(date)})`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Today, not a dashboard. The hero is the date and one honest sentence. */
function TodayScreen() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()

  // One clock read per render, passed into the pure domain function.
  const now = useMemo(() => new Date(), [])
  const today = useMemo(() => buildToday(itemsQuery.data ?? [], now), [itemsQuery.data, now])

  // Straight from the stored status. Regularizada is "cursó, falta el final":
  // counting it as Cursando overstates what the student is attending.
  const cursando = useMemo(
    () => plan.views.filter((v) => v.status === 'in_progress'),
    [plan.views],
  )
  const finalPendiente = useMemo(
    () => plan.views.filter((v) => v.status === 'regularized'),
    [plan.views],
  )

  const count = today.overdue.length + today.today.length
  const isLoading = itemsQuery.isLoading || plan.isLoading
  const headline = todayHeadline({
    dueToday: count,
    upcoming: today.upcoming.map((e) => ({ title: e.item.title, daysLeft: e.daysLeft })),
    undated: today.undated.length,
  })

  const subjectName = (id: string | null) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null

  const { complete, dialog } = useCompleteItem(subjectName)

  const renderRows = (entries: (AgendaEntry & { daysLeft?: number })[], overdue = false) =>
    entries.map((entry) => (
      <DeadlineRow
        key={entry.item.id}
        item={entry.item}
        overdue={overdue}
        dayLabel={whenLabel(entry)}
        subjectName={subjectName(entry.item.curriculumSubjectId)}
        subjectId={entry.item.curriculumSubjectId}
        onToggle={(done) => complete(entry.item, done)}
      />
    ))

  return (
    <div className="flex flex-col gap-9">
      {dialog}
      <PageHeader
        eyebrow={capitalize(DATE_FORMAT.format(now))}
        title={isLoading ? '¿Qué tenés para hoy?' : headline.title}
        description={!isLoading ? headline.description : undefined}
      />

      {itemsQuery.error ? (
        <ErrorState
          error={itemsQuery.error as Error}
          onRetry={() => void itemsQuery.refetch()}
        />
      ) : null}

      {isLoading ? (
        <section aria-label="Cargando">
          <LoadingRows rows={4} />
        </section>
      ) : (
        <>
          {today.overdue.length > 0 ? (
            <section aria-labelledby="atrasadas" className="flex flex-col gap-1">
              <SectionHeading id="atrasadas" aside={`${today.overdue.length}`}>
                Atrasadas
              </SectionHeading>
              <div>{renderRows(today.overdue, true)}</div>
            </section>
          ) : null}

          {/* Only when it has something to say: with nothing due, the headline
              already said so, and a second "nada" under it was the same sentence twice. */}
          {today.today.length > 0 || today.overdue.length > 0 ? (
            <section aria-labelledby="hoy" className="flex flex-col gap-1">
              <SectionHeading id="hoy">Hoy</SectionHeading>
              {today.today.length > 0 ? (
                <div>{renderRows(today.today)}</div>
              ) : (
                <p className="text-ink-muted py-3 text-sm">Nada más agendado para hoy.</p>
              )}
            </section>
          ) : null}

          {today.upcoming.length > 0 ? (
            <section aria-labelledby="proximas" className="flex flex-col gap-1">
              <SectionHeading id="proximas" aside={`${today.upcoming.length}`}>
                Próximas
              </SectionHeading>
              <div>{renderRows(today.upcoming)}</div>
              <Link
                to="/calendar"
                className="text-accent-ink mt-2 self-start text-sm font-medium underline-offset-4 hover:underline"
              >
                Ver el calendario
              </Link>
            </section>
          ) : null}

          {today.undated.length > 0 ? (
            <section aria-labelledby="sin-fecha" className="flex flex-col gap-1">
              <SectionHeading id="sin-fecha" aside={`${today.undated.length}`}>
                Sin fecha
              </SectionHeading>
              <div>{renderRows(today.undated)}</div>
            </section>
          ) : null}

          {cursando.length > 0 ? (
            <SubjectGroup id="cursando" title="Cursando" subjects={cursando} />
          ) : null}

          {finalPendiente.length > 0 ? (
            <SubjectGroup
              id="final-pendiente"
              title="Final pendiente"
              subjects={finalPendiente}
            />
          ) : null}

          {plan.hasContext && !plan.isUnmapped && plan.progress.total > 0 ? (
            <section aria-labelledby="progreso" className="flex flex-col gap-3">
              <SectionHeading id="progreso">Tu carrera</SectionHeading>
              <ProgressLine
                value={plan.progress.passed + plan.progress.equivalent}
                total={plan.progress.total}
              />
              <Link
                to="/plan"
                className="text-accent-ink self-start text-sm font-medium underline-offset-4 hover:underline"
              >
                Ver tu plan
              </Link>
            </section>
          ) : null}

          {/* Order matters: an errored context is NOT "no elegiste tu carrera".
              Rendering that empty state here would invite the student into onboarding,
              where re-running it deactivates the context they already had. */}
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
          ) : null}
        </>
      )}
    </div>
  )
}

function SubjectGroup({
  id,
  title,
  subjects,
}: {
  id: string
  title: string
  subjects: readonly SubjectView[]
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <SectionHeading id={id} aside={`${subjects.length}`}>
        {title}
      </SectionHeading>
      <ul>
        {subjects.map((subject) => (
          <li key={subject.id}>
            <Link
              to="/courses/$courseId"
              params={{ courseId: subject.id }}
              className="border-rule-soft text-ink hover:bg-paper-elevated flex items-center gap-3 border-b py-3 text-sm transition-colors"
            >
              <StatusGlyph status={subject.status} />
              <span className="min-w-0 flex-1 truncate">{subject.name}</span>
              <span className="text-ink-muted shrink-0 text-xs">{subject.yearLevel}° año</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
