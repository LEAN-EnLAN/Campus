import { createFileRoute } from '@tanstack/react-router'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { CampusCalendar } from '@/features/calendar/campus-calendar'
import { useAcademicItems } from '@/features/items/queries'

export const Route = createFileRoute('/_app/calendar')({
  component: CalendarScreen,
})

/**
 * CAP-CALENDAR-001 — everything captured anywhere shows up here.
 *
 * This used to be Today with a different grouping: a stack of day sections, no
 * grid, no time axis, no month. It is now a real calendar, and the route's only
 * job is the question a route may ask — is there anything to show?
 */
function CalendarScreen() {
  const itemsQuery = useAcademicItems()

  if (itemsQuery.error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          error={itemsQuery.error as Error}
          onRetry={() => void itemsQuery.refetch()}
        />
      </div>
    )
  }

  if (itemsQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingRows rows={6} />
      </div>
    )
  }

  if ((itemsQuery.data ?? []).length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState
          title="Todavía no anotaste nada"
          description="Cuando cargues un parcial o una entrega, va a aparecer en el calendario."
        />
      </div>
    )
  }

  return <CampusCalendar />
}
