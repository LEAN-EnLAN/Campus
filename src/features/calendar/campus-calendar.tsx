import {
  createAgendaView,
  createMonthView,
  createWeekView,
  DayFlowCalendar,
  useCalendarApp,
  en,
  registerLocale,
  ViewType,
  type CalendarType,
  type CalendarViewType,
  type EventContentSlotArgs,
  type EventDetailContentProps,
  type Locale,
} from '@dayflow/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import { itemKindLabel } from '@/components/deadline-row'
import { Button } from '@/components/ui/button'
import type { AcademicItem } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { useAcademicItems, useToggleAcademicItem } from '@/features/items/queries'
import type { PaletteTheme } from '@/lib/design/palette'
import { useTheme } from '@/lib/theme/theme-context'
import { cn } from '@/lib/utils'

import { projectAcademicItems, UNASSIGNED_CALENDAR } from './academic-events'
import { eventPaint, hueForSubject, type EventPaint } from './event-paint'

/**
 * The calendar, wearing Campus.
 *
 * DayFlow renders the grid; every pixel of CONTENT inside it is ours, through
 * the slot renderers. That split is the whole point of the adaptation: we get
 * a real month/week/agenda engine — layout, overlap resolution, all-day rows,
 * timezones — without inheriting somebody else's visual language.
 *
 * Colour is the one place a calendar library will fight a design system, so it
 * is settled here: DayFlow groups events into "calendars", and ours are the
 * student's SUBJECTS. Hue says which subject, shade says how much the event
 * matters — see `event-paint.ts`.
 */

/** Chrome strings DayFlow renders itself, in the app's language. */
const VIEW_LABEL: Record<string, string> = {
  [ViewType.MONTH]: 'Mes',
  [ViewType.WEEK]: 'Semana',
  [ViewType.AGENDA]: 'Agenda',
}

/**
 * Spanish chrome.
 *
 * Only `en-US` ships in the bundle, and passing the string `'es-AR'` reaches
 * Intl — day and month names — but not the library's own strings, which is how
 * an agenda ends up saying "No events" in the middle of a Spanish app. Built by
 * EXTENDING `en` rather than listing our own keys: a partial dictionary renders
 * `undefined` the day the vendor adds a message.
 */
const ES_AR: Locale = {
  code: 'es-AR',
  messages: {
    ...en.messages,
    allDay: 'Todo el día',
    noEvents: 'Nada este día',
    more: 'más',
    today: 'Hoy',
    day: 'Día',
    week: 'Semana',
    month: 'Mes',
    year: 'Año',
    agenda: 'Agenda',
    tomorrow: 'Mañana',
    calendar: 'Calendario',
    calendars: 'Calendarios',
    search: 'Buscar',
    noResults: 'Nada coincide.',
    untitled: 'Sin título',
    starts: 'Empieza',
    ends: 'Termina',
    notes: 'Notas',
    note: 'Nota',
    done: 'Hecho',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    viewEvent: 'Ver',
    editEvent: 'Editar',
  },
}

// Registered, not just passed: the config's `locale` resolves a CODE against
// the global registry, so handing it a loose object leaves the dictionary on
// the English default.
registerLocale(ES_AR)

/**
 * One DayFlow calendar per SUBJECT.
 *
 * This reverses the first design, and the reversal is the point. It used to be
 * one calendar per KIND because a palette with a single accent cannot carry
 * forty subjects. The palette now GENERATES a harmonic hue per subject, so the
 * two channels can finally say different things: the hue says which subject,
 * the shade says how much the event matters. See `event-paint.ts`.
 *
 * A calendar per subject also hands the student a subject filter for free,
 * which is the one they actually want.
 */
function buildCalendars(
  subjectIds: readonly string[],
  names: Map<string, string>,
  theme: PaletteTheme,
): CalendarType[] {
  const entry = (id: string, name: string): CalendarType => {
    // The calendar's own colour is the subject at full emphasis. Per-event
    // shading happens in the chip, which paints over this.
    const paint = eventPaint(
      hueForSubject(id === UNASSIGNED_CALENDAR ? null : id, subjectIds),
      'midterm',
      theme,
      false,
    )
    return {
      id,
      name,
      colors: {
        eventColor: paint.bg,
        eventSelectedColor: paint.bg,
        lineColor: paint.line,
        textColor: paint.ink,
      },
    }
  }

  return [
    ...subjectIds.map((id) => entry(id, names.get(id) ?? id)),
    entry(UNASSIGNED_CALENDAR, 'Sin materia'),
  ]
}

const TIME_FORMAT = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const TITLE_FORMAT = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

/** The domain object every slot needs, recovered from the event we built. */
function itemOf(meta: Record<string, unknown> | undefined): AcademicItem | null {
  const item = meta?.item
  return item ? (item as AcademicItem) : null
}

function timeLabel(item: AcademicItem): string | null {
  const anchor = item.dueAt ?? item.startsAt
  if (!anchor) return null
  const date = new Date(anchor)
  if (Number.isNaN(date.getTime())) return null
  if (date.getHours() === 0 && date.getMinutes() === 0) return null
  return TIME_FORMAT.format(date)
}

export function CampusCalendar() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const toggleItem = useToggleAcademicItem()
  const { theme } = useTheme()

  // The ORDER is the colour assignment, so it has to be the plan's own order —
  // stable across reloads, and the same one the student sees everywhere else.
  const subjectIds = useMemo(() => plan.views.map((v) => v.id), [plan.views])
  const subjectNames = useMemo(
    () => new Map(plan.views.map((v) => [v.id, v.name])),
    [plan.views],
  )
  const calendars = useMemo(
    () => buildCalendars(subjectIds, subjectNames, theme),
    [subjectIds, subjectNames, theme],
  )

  /** One event's paint: its subject's hue, shaded by what kind of event it is. */
  const paintFor = useCallback(
    (item: AcademicItem) =>
      eventPaint(
        hueForSubject(item.curriculumSubjectId, subjectIds),
        item.kind,
        theme,
        item.status === 'done',
      ),
    [subjectIds, theme],
  )

  const { events, undated } = useMemo(
    () => projectAcademicItems(itemsQuery.data ?? []),
    [itemsQuery.data],
  )

  // `dataUpdatedAt` is the version: it changes exactly when the item list does,
  // which is what tells the calendar app to adopt a new event set.
  const calendar = useCalendarApp(
    {
      views: [
        // 22px, not the 16px default: at our reading size a chip's line box is
        // 23px, so the default cropped every ascender and descender. Set
        // through the config because the height is written as an INLINE style
        // — CSS could only win it with `!important`.
        createMonthView({ startOfWeek: 1, gridDateClick: 'week-view', eventHeight: 22 }),
        createWeekView({ startOfWeek: 1, scrollToCurrentTime: true }),
        createAgendaView(),
      ],
      defaultView: ViewType.MONTH,
      events,
      calendars,
      locale: ES_AR.code,
      useCalendarHeader: true,
      // Dragging an event would move a deadline, and the items capability has
      // no way to persist a new date — only `setDone`. A grid that lets you
      // move something and silently forgets is worse than one that does not.
      readOnly: { draggable: false, viewable: true },
      timeFormat: '24h',
    },
    // Re-key on the palette too: a theme or accent change repaints every
    // calendar, and the app has to adopt the new colours.
    `${itemsQuery.dataUpdatedAt}:${theme}:${calendars.length}`,
  )

  const subjectName = (item: AcademicItem) =>
    item.curriculumSubjectId
      ? (plan.subjectById.get(item.curriculumSubjectId)?.name ?? null)
      : null

  return (
    <div className="flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1">
      <DayFlowCalendar
        calendar={calendar}
        calendarHeader={() => (
          <CalendarChrome
            title={TITLE_FORMAT.format(calendar.currentDate)}
            view={calendar.currentView}
            onView={calendar.changeView}
            onPrevious={() => calendar.app.goToPrevious()}
            onNext={() => calendar.app.goToNext()}
            onToday={() => calendar.app.goToToday()}
          />
        )}
        eventContentMonth={(args) => (
          <MonthChip args={args} subjectName={subjectName} paintFor={paintFor} />
        )}
        eventContentWeek={(args) => (
          <GridChip args={args} subjectName={subjectName} paintFor={paintFor} />
        )}
        eventContentDay={(args) => (
          <GridChip args={args} subjectName={subjectName} paintFor={paintFor} />
        )}
        eventDetailContent={(args) => (
          <EventDetail
            args={args}
            subjectName={subjectName}
            onToggle={(id, done) => toggleItem.mutate({ id, done })}
          />
        )}
      />

      {undated.length > 0 && (
        <p className="text-ink-muted border-rule border-t px-4 py-2 text-xs">
          {undated.length === 1
            ? '1 cosa sin fecha no entra en el calendario.'
            : `${undated.length} cosas sin fecha no entran en el calendario.`}{' '}
          <span className="text-ink-faint">Se ven en Hoy.</span>
        </p>
      )}
    </div>
  )
}

/** Our header, our controls. DayFlow only tells us where it goes. */
function CalendarChrome({
  title,
  view,
  onView,
  onPrevious,
  onNext,
  onToday,
}: {
  title: string
  view: CalendarViewType
  onView: (view: CalendarViewType) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="border-rule flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Período anterior" onClick={onPrevious}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Período siguiente" onClick={onNext}>
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday}>
          Hoy
        </Button>
        <h2 className="text-ink ml-2 font-serif text-lg font-semibold first-letter:uppercase">
          {title}
        </h2>
      </div>

      <div className="border-rule flex items-center gap-px rounded-md border p-0.5">
        {Object.entries(VIEW_LABEL).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-current={view === value ? 'true' : undefined}
            onClick={() => onView(value)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-xs',
              view === value
                ? 'bg-accent-soft text-accent-ink font-medium'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The month cell chip: one 22px line at rest, the whole item on hover.
 *
 * A month grid is scanned for "when", so the resting state shows only what
 * survives a 170px cell — time, then a truncated title. The rest is rendered
 * anyway and revealed on hover, where the chip lifts out of its cell and
 * shows the full title, the kind and the subject.
 *
 * The reveal is CSS, in `globals.css`, because it has to defeat the vendor's
 * `overflow: hidden` on both the chip and the day cell. The markup's job is to
 * put the content there and name the parts.
 */
function MonthChip({
  args,
  subjectName,
  paintFor,
}: {
  args: EventContentSlotArgs
  subjectName: (item: AcademicItem) => string | null
  paintFor: (item: AcademicItem) => EventPaint
}) {
  const item = itemOf(args.event.meta)
  if (!item) return null
  const time = timeLabel(item)
  const subject = subjectName(item)
  const done = item.status === 'done'
  const detail = [itemKindLabel(item.kind), subject].filter(Boolean).join(' · ')
  const paint = paintFor(item)

  return (
    <span
      className={cn('df-campus-chip', done && 'opacity-55')}
      style={{ backgroundColor: paint.bg, color: paint.ink, borderColor: paint.line }}
    >
      <span className="df-campus-chip-line">
        {time && <span className="df-campus-chip-time">{time}</span>}
        <span className={cn('df-campus-chip-title', done && 'line-through')}>{item.title}</span>
      </span>
      {/* Present at rest, clipped by the chip's own height; the hover rule is
          what gives it room rather than a second render. */}
      <span className="df-campus-chip-detail">{detail}</span>
    </span>
  )
}

/** The week/day block: there is room for the subject here, so it earns its place. */
function GridChip({
  args,
  subjectName,
  paintFor,
}: {
  args: EventContentSlotArgs
  subjectName: (item: AcademicItem) => string | null
  paintFor: (item: AcademicItem) => EventPaint
}) {
  const item = itemOf(args.event.meta)
  if (!item) return null
  const subject = subjectName(item)
  const done = item.status === 'done'
  const paint = paintFor(item)

  // The SAME chip family as the month view. The week grid used to be a bare
  // flex column with square corners while the month was rounded and lifted —
  // one calendar should not look like two products depending on the view.
  return (
    <span
      className={cn('df-campus-chip df-campus-chip-block', done && 'opacity-55')}
      style={{ backgroundColor: paint.bg, color: paint.ink, borderColor: paint.line }}
    >
      <span className={cn('df-campus-chip-title', done && 'line-through')}>{item.title}</span>
      {subject && <span className="df-campus-chip-detail">{subject}</span>}
    </span>
  )
}

/**
 * The detail panel — the one place the calendar becomes useful rather than
 * decorative, because it is where a student marks something done.
 */
function EventDetail({
  args,
  subjectName,
  onToggle,
}: {
  args: EventDetailContentProps
  subjectName: (item: AcademicItem) => string | null
  onToggle: (id: string, done: boolean) => void
}) {
  const item = itemOf(args.event.meta)
  if (!item) return null
  const subject = subjectName(item)
  const time = timeLabel(item)
  const done = item.status === 'done'

  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="text-2xs text-ink-muted tracking-[0.18em] uppercase">
          {itemKindLabel(item.kind)}
        </p>
        <h3 className="text-ink font-serif text-lg font-semibold">{item.title}</h3>
        {subject && <p className="text-ink-muted text-sm">{subject}</p>}
      </div>

      <p className="text-ink-muted text-sm">
        {time ? `A las ${time}` : 'Sin hora — cuenta para todo el día.'}
      </p>

      {item.notes && <p className="text-ink text-sm">{item.notes}</p>}

      <Button
        variant={done ? 'ghost' : 'primary'}
        size="sm"
        onClick={() => {
          onToggle(item.id, !done)
          args.onClose?.()
        }}
      >
        {done ? 'Marcar como pendiente' : 'Marcar como hecho'}
      </Button>
    </div>
  )
}
