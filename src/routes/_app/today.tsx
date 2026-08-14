import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'

import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { ProgressLine } from '@/components/progress-line'
import { StatusGlyph } from '@/components/academic-status'
import { buildAgenda, todayCount, type AgendaEntry } from '@/domain/agenda'
import { activeSubjects } from '@/domain/progress'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems, useToggleAcademicItem } from '@/features/items/queries'

export const Route = createFileRoute('/_app/today')({
  component: TodayScreen,
})

const DATE_FORMAT = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Today, not a dashboard. The hero is the date and one honest sentence. */
function TodayScreen() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const toggleItem = useToggleAcademicItem()

  // One clock read per render, passed into the pure domain function.
  const now = useMemo(() => new Date(), [])
  const agenda = useMemo(() => buildAgenda(itemsQuery.data ?? [], now), [itemsQuery.data, now])

  const active = useMemo(() => activeSubjects(plan.views), [plan.views])
  const count = todayCount(agenda)
  const isLoading = itemsQuery.isLoading || plan.isLoading

  const subjectName = (id: string | null) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null

  const renderRows = (entries: AgendaEntry[], overdue = false) =>
    entries.map((entry) => (
      <DeadlineRow
        key={entry.item.id}
        item={entry.item}
        overdue={overdue}
        subjectName={subjectName(entry.item.curriculumSubjectId)}
        subjectId={entry.item.curriculumSubjectId}
        onToggle={(done) => toggleItem.mutate({ id: entry.item.id, done })}
      />
    ))

  return (
    <div className="flex flex-col gap-9">
      <PageHeader
        eyebrow={capitalize(DATE_FORMAT.format(now))}
        title={
          isLoading
            ? '¿Qué tenés para hoy?'
            : count === 0
              ? 'No tenés nada para hoy.'
              : count === 1
                ? 'Tenés una cosa para hoy.'
                : `Tenés ${count} cosas para hoy.`
        }
        description={
          !isLoading && count === 0
            ? 'Buen momento para adelantar algo, o para no hacer nada.'
            : undefined
        }
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
          {agenda.overdue.length > 0 ? (
            <section aria-labelledby="atrasadas" className="flex flex-col gap-1">
              <SectionHeading id="atrasadas" aside={`${agenda.overdue.length}`}>
                Atrasadas
              </SectionHeading>
              <div>{renderRows(agenda.overdue, true)}</div>
            </section>
          ) : null}

          <section aria-labelledby="hoy" className="flex flex-col gap-1">
            <SectionHeading id="hoy">Hoy</SectionHeading>
            {agenda.today.length > 0 ? (
              <div>{renderRows(agenda.today)}</div>
            ) : (
              <p className="text-ink-muted py-3 text-sm">Nada agendado para hoy.</p>
            )}
          </section>

          {agenda.tomorrow.length > 0 || agenda.week.length > 0 ? (
            <section aria-labelledby="proximamente" className="flex flex-col gap-1">
              <SectionHeading id="proximamente">Próximamente</SectionHeading>
              <div>
                {renderRows(agenda.tomorrow)}
                {renderRows(agenda.week)}
              </div>
              <Link
                to="/calendar"
                className="text-accent mt-2 self-start text-sm font-medium underline-offset-4 hover:underline"
              >
                Ver el calendario
              </Link>
            </section>
          ) : null}

          {active.length > 0 ? (
            <section aria-labelledby="cursando" className="flex flex-col gap-1">
              <SectionHeading id="cursando" aside={`${active.length}`}>
                Cursando
              </SectionHeading>
              <ul>
                {active.map((subject) => (
                  <li key={subject.id}>
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: subject.id }}
                      className="border-rule-soft text-ink hover:bg-paper-elevated flex items-center gap-3 border-b py-3 text-sm transition-colors"
                    >
                      <StatusGlyph status={subject.status} />
                      <span className="min-w-0 flex-1 truncate">{subject.name}</span>
                      <span className="text-ink-muted shrink-0 text-xs">
                        {subject.yearLevel}° año
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
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
                className="text-accent self-start text-sm font-medium underline-offset-4 hover:underline"
              >
                Ver tu plan
              </Link>
            </section>
          ) : null}

          {!plan.hasContext && !plan.isLoading ? (
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
          ) : null}
        </>
      )}
    </div>
  )
}
