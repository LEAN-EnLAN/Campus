import { createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { itemsInRange, weekDays } from '@/domain/agenda'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems, useToggleAcademicItem } from '@/features/items/queries'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/calendar')({
  component: CalendarScreen,
})

const DAY_FORMAT = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric' })
const RANGE_FORMAT = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' })

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** CAP-CALENDAR-001 — agenda/week first. Everything captured anywhere shows up here. */
function CalendarScreen() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const toggleItem = useToggleAcademicItem()

  const today = useMemo(() => new Date(), [])
  const [weekOffset, setWeekOffset] = useState(0)

  const anchor = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + weekOffset * 7)
    return d
  }, [today, weekOffset])

  const days = useMemo(() => weekDays(anchor), [anchor])

  const allItems = itemsQuery.data
  const itemsByDay = useMemo(() => {
    const all = allItems ?? []
    return days.map((day) => ({ day, items: itemsInRange(all, day, day) }))
  }, [days, allItems])

  const subjectName = (id: string | null) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null

  const first = days[0]!
  const last = days[6]!
  const total = itemsByDay.reduce((n, d) => n + d.items.length, 0)

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={`${RANGE_FORMAT.format(first)} – ${RANGE_FORMAT.format(last)}`}
        title="Tu semana"
        actions={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Semana siguiente"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        }
      />

      {itemsQuery.error ? (
        <ErrorState
          error={itemsQuery.error as Error}
          onRetry={() => void itemsQuery.refetch()}
        />
      ) : null}

      {itemsQuery.isLoading ? (
        <LoadingRows rows={6} />
      ) : total === 0 ? (
        <EmptyState
          title="No tenés nada esta semana"
          description="Cuando anotes un parcial o una entrega, va a aparecer acá."
        />
      ) : (
        itemsByDay.map(({ day, items: dayItems }) => {
          const current = isSameDay(day, today)
          if (dayItems.length === 0 && !current) return null

          return (
            <section
              key={day.toISOString()}
              aria-labelledby={`dia-${day.getDate()}`}
              className="flex flex-col gap-1"
            >
              <SectionHeading
                id={`dia-${day.getDate()}`}
                className={cn(current && '[&_h2]:text-accent')}
                aside={current ? 'hoy' : undefined}
              >
                {capitalize(DAY_FORMAT.format(day))}
              </SectionHeading>

              {dayItems.length === 0 ? (
                <p className="text-ink-muted py-3 text-sm">Nada para hoy.</p>
              ) : (
                <div>
                  {dayItems.map((item) => (
                    <DeadlineRow
                      key={item.id}
                      item={item}
                      subjectName={subjectName(item.curriculumSubjectId)}
                      subjectId={item.curriculumSubjectId}
                      onToggle={(done) => toggleItem.mutate({ id: item.id, done })}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
