import {
  createMonthView,
  createWeekView,
  DayFlowCalendar,
  useCalendarApp,
  en,
  registerLocale,
  ViewType,
  type CalendarType,
  type EventContentSlotArgs,
  type EventDetailContentProps,
  type Locale,
} from '@dayflow/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { itemKindLabel } from '@/components/deadline-row'
import { Button } from '@/components/ui/button'
import type { AcademicItem } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { dueTimeLabel } from '@/features/items/due'
import { useAcademicItems } from '@/features/items/queries'
import { useCompleteItem } from '@/features/items/use-complete-item'
import type { PaletteTheme } from '@/lib/design/palette'
import { useTheme } from '@/lib/theme/theme-context'
import { cn } from '@/lib/utils'

import { projectAcademicItems, UNASSIGNED_CALENDAR } from './academic-events'
import { AgendaList } from './agenda-list'
import { undatedNote } from './undated-note'
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

/**
 * The three ways to read the calendar. Month and week are DayFlow's; the agenda
 * is a list of our own (see `agenda-list.tsx`), so it is not a DayFlow view.
 */
type Mode = 'month' | 'week' | 'agenda'

const MODES: { value: Mode; label: string }[] = [
  { value: 'month', label: 'Mes' },
  { value: 'week', label: 'Semana' },
  { value: 'agenda', label: 'Agenda' },
]

/** Where the week grid opens: a student's day starts in the morning, not at midnight. */
const WEEK_OPENS_AT_HOUR = 7
const HOUR_HEIGHT_PX = 72

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

const TITLE_FORMAT = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })

/** The domain object every slot needs, recovered from the event we built. */
function itemOf(meta: Record<string, unknown> | undefined): AcademicItem | null {
  const item = meta?.item
  return item ? (item as AcademicItem) : null
}

const timeLabel = dueTimeLabel

export function CampusCalendar() {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
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
        // Not `scrollToCurrentTime`: opened at 04:00 or at 23:40 it parks the
        // grid on a night-time window. The effect below opens it at the morning.
        createWeekView({ startOfWeek: 1, scrollToCurrentTime: false }),
      ],
      defaultView: ViewType.MONTH,
      events,
      calendars,
      locale: ES_AR.code,
      // The header is ours and lives outside the grid (see below), so the agenda
      // list can share it.
      useCalendarHeader: false,
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

  const { complete, dialog } = useCompleteItem((id) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null,
  )

  const [agendaOpen, setAgendaOpen] = useState(false)
  const mode: Mode = agendaOpen
    ? 'agenda'
    : calendar.currentView === ViewType.WEEK
      ? 'week'
      : 'month'
  const now = useMemo(() => new Date(), [])

  const gridRef = useRef<HTMLDivElement>(null)
  useSpanishVendorLabels(gridRef)
  useEffect(() => {
    if (mode !== 'week') return
    const frame = window.requestAnimationFrame(() => {
      const scroller = gridRef.current?.querySelector<HTMLElement>(
        '.df-week-time-grid-scroller',
      )
      if (scroller) scroller.scrollTop = WEEK_OPENS_AT_HOUR * HOUR_HEIGHT_PX
    })
    return () => window.cancelAnimationFrame(frame)
  }, [mode])

  const selectMode = (next: Mode) => {
    setAgendaOpen(next === 'agenda')
    if (next === 'month') calendar.changeView(ViewType.MONTH)
    if (next === 'week') calendar.changeView(ViewType.WEEK)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {dialog}
      <CalendarChrome
        // The agenda names its own period in its own header; a month title
        // above it would say something else.
        title={mode === 'agenda' ? null : TITLE_FORMAT.format(calendar.currentDate)}
        mode={mode}
        onMode={selectMode}
        onPrevious={() => calendar.app.goToPrevious()}
        onNext={() => calendar.app.goToNext()}
        onToday={() => calendar.app.goToToday()}
      />

      {mode === 'agenda' ? (
        <AgendaList
          items={itemsQuery.data ?? []}
          now={now}
          subjectName={subjectName}
          onToggle={complete}
        />
      ) : null}

      {/* The stretch rule is scoped to THIS box. It used to sit on the outer
          column, where `[&>*]:flex-1` also caught the "sin fecha" footnote and
          split the viewport 50/50 between it and the grid — the "400px blank
          band" whenever an undated item existed. */}
      <div
        ref={gridRef}
        data-testid="calendar-grid"
        hidden={mode === 'agenda'}
        className="flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1"
      >
        <DayFlowCalendar
          calendar={calendar}
          eventContentMonth={(args) => (
            <MonthChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          // All-day items (a date with no time) are one-line chips in every view;
          // left to the library they were painted with its own light-on-light
          // style and, in the week header, were close to invisible.
          eventContentAllDayMonth={(args) => (
            <MonthChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          eventContentAllDayWeek={(args) => (
            <MonthChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          eventContentAllDayDay={(args) => (
            <MonthChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          eventContentWeek={(args) => (
            <GridChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          eventContentDay={(args) => (
            <GridChip args={args} subjectName={subjectName} paintFor={paintFor} />
          )}
          eventDetailContent={(args) => (
            <EventDetail args={args} subjectName={subjectName} onToggle={complete} />
          )}
        />
      </div>

      {undated.length > 0 && (
        <p className="text-ink-muted border-rule border-t py-2 pr-20 pl-4 text-xs md:pr-4">
          {undatedNote(undated.length)}
        </p>
      )}
    </div>
  )
}

/** Our header, our controls. DayFlow only draws the grid under it. */
function CalendarChrome({
  title,
  mode,
  onMode,
  onPrevious,
  onNext,
  onToday,
}: {
  title: string | null
  mode: Mode
  onMode: (mode: Mode) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <div className="border-rule flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-center gap-1">
        {mode === 'agenda' ? null : (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Período anterior"
              onClick={onPrevious}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Período siguiente" onClick={onNext}>
              <ChevronRight aria-hidden="true" />
            </Button>
            <Button variant="ghost" onClick={onToday} className="h-8 px-3 text-xs">
              Hoy
            </Button>
          </>
        )}
        {title ? (
          <h2 className="text-ink ml-2 font-serif text-lg font-semibold first-letter:uppercase">
            {title}
          </h2>
        ) : null}
      </div>

      <div
        role="group"
        aria-label="Vista del calendario"
        className="border-rule flex items-center gap-px rounded-md border p-0.5"
      >
        {MODES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onMode(value)}
            className={cn(
              'min-h-8 rounded-sm px-3 text-xs',
              mode === value
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
 * The calendar library's navigation buttons carry English `aria-label`s
 * ("Previous month") that no locale dictionary reaches. They sit inside a header
 * we hide, so a screen reader should never meet them — but "should never" is not
 * a guarantee worth leaving to a stylesheet, so they are translated as they appear.
 */
const VENDOR_LABELS: Record<string, string> = {
  'Previous month': 'Mes anterior',
  'Next month': 'Mes siguiente',
}

function useSpanishVendorLabels(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const translate = () => {
      for (const [english, spanish] of Object.entries(VENDOR_LABELS)) {
        for (const el of root.querySelectorAll(`[aria-label="${english}"]`)) {
          el.setAttribute('aria-label', spanish)
        }
      }
    }
    translate()
    const observer = new MutationObserver(translate)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [ref])
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
  onToggle: (item: AcademicItem, done: boolean) => void
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
          onToggle(item, !done)
          args.onClose?.()
        }}
      >
        {done ? 'Marcar como pendiente' : 'Marcar como hecho'}
      </Button>
    </div>
  )
}
