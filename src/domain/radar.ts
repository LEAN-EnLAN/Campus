import { dayOffset } from './agenda'
import { pendingFinals } from './pending-finals'
import { joinNames } from './requirements'
import type { AcademicItem, AcademicItemKind, SubjectView } from './types'

/**
 * Radar — what matters right now, as a handful of cards.
 *
 * Pure: the caller passes the items, the resolved subject views and `now`.
 * Same input, same cards, same order. Every academic claim comes from data the
 * domain already resolved (`SubjectView.missingRequirements`, the official
 * correlativas); nothing here guesses a correlativa.
 */

export type RadarInsightKind =
  | 'due-now'
  | 'next-up'
  | 'get-ahead'
  | 'final-to-book'
  | 'unlock-soon'
  | 'heavy-week'
  | 'all-clear'

/** Where a card leads. The screen maps each one to a route; the domain knows no URLs. */
export type RadarTarget =
  | { kind: 'agenda'; section: 'overdue' | 'today' | 'upcoming' | 'later' }
  | { kind: 'subject'; subjectId: string }
  | { kind: 'calendar' }
  | { kind: 'pending-finals' }
  | { kind: 'capture' }

/** How far away the next thing is, for the hero numeral. */
export type RadarCountdown =
  { unit: 'today' } | { unit: 'hours'; value: number } | { unit: 'days'; value: number }

export interface RadarInsight {
  /** Stable across recomputes: `kind:subject-or-item`. Used as the React key. */
  id: string
  kind: RadarInsightKind
  /** Higher first. */
  priority: number
  title: string
  /** One line: why this card is here. */
  reason: string
  target: RadarTarget
  /** The one action the card offers. It always leads to `target`. */
  actionLabel: string
  /** The item the card is about, when it is about exactly one. */
  item?: AcademicItem
  /** Only on `next-up`. */
  countdown?: RadarCountdown
}

export interface RadarInput {
  items: readonly AcademicItem[]
  subjects: readonly SubjectView[]
  /** False when the source never published correlativas: no unlock claims then. */
  prerequisitesKnown: boolean
  now: Date
  /** Did the student give this instant a time of day? Date-only items count in days. */
  hasTime?: (iso: string) => boolean
}

/** At most this many cards, the hero included. */
export const RADAR_MAX = 5

/** `get-ahead` looks at things due in this window, in days from today. */
export const GET_AHEAD_FROM = 3
export const GET_AHEAD_TO = 14

/** A week with at least this many evaluations is a heavy one. */
export const HEAVY_WEEK_MIN = 3
/** How many weeks ahead, counting this one, `heavy-week` looks. */
export const HEAVY_WEEK_SPAN = 3

const PRIORITY: Record<RadarInsightKind, number> = {
  'next-up': 1000,
  'due-now': 900,
  'heavy-week': 700,
  'get-ahead': 600,
  'final-to-book': 500,
  'unlock-soon': 400,
  'all-clear': 100,
}

/** How much a kind of item weighs when choosing what to start early. */
const WEIGHT: Partial<Record<AcademicItemKind, number>> = {
  final: 4,
  midterm: 3,
  assignment: 2,
  task: 1,
  custom: 1,
}

/** The kinds that count as an evaluation for `heavy-week`. */
const EVALUATION_WORDS: Partial<Record<AcademicItemKind, readonly [string, string]>> = {
  midterm: ['parcial', 'parciales'],
  final: ['final', 'finales'],
  assignment: ['entrega', 'entregas'],
}

const MS_PER_HOUR = 3_600_000

// Local on purpose: `src/domain` may not import `src/lib` (see eslint.config.js).
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)
const countLabel = (n: number, one: string, many: string) => `${n} ${plural(n, one, many)}`

interface Dated {
  item: AcademicItem
  at: Date
  offset: number
}

function anchor(item: AcademicItem): string | null {
  return item.dueAt ?? item.startsAt
}

function datedOpen(items: readonly AcademicItem[], now: Date): Dated[] {
  const dated: Dated[] = []
  for (const item of items) {
    if (item.status !== 'open') continue
    const raw = anchor(item)
    if (!raw) continue
    const at = new Date(raw)
    if (Number.isNaN(at.getTime())) continue
    dated.push({ item, at, offset: dayOffset(now, at) })
  }
  return dated.sort(
    (a, b) => a.at.getTime() - b.at.getTime() || a.item.title.localeCompare(b.item.title, 'es'),
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const dayMonth = (date: Date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`

function inDays(offset: number): string {
  if (offset === 0) return 'hoy'
  if (offset === 1) return 'mañana'
  return `en ${offset} días`
}

function withSubject(text: string, subject: string | null): string {
  return subject ? `${text} · ${subject}` : text
}

function countdownFor(entry: Dated, now: Date, hasTime: (iso: string) => boolean): RadarCountdown {
  if (entry.offset > 0) return { unit: 'days', value: entry.offset }
  const raw = anchor(entry.item)
  if (raw && hasTime(raw)) {
    const hours = Math.ceil((entry.at.getTime() - now.getTime()) / MS_PER_HOUR)
    if (hours > 0) return { unit: 'hours', value: hours }
  }
  return { unit: 'today' }
}

function itemTarget(entry: Dated): RadarTarget {
  const subjectId = entry.item.curriculumSubjectId
  if (subjectId) return { kind: 'subject', subjectId }
  if (entry.offset < 0) return { kind: 'agenda', section: 'overdue' }
  if (entry.offset === 0) return { kind: 'agenda', section: 'today' }
  return { kind: 'agenda', section: entry.offset <= GET_AHEAD_TO ? 'upcoming' : 'later' }
}

/** Monday 00:00 local of the week `date` falls in. */
function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - weekday)
  return start
}

function nextUp(
  dated: readonly Dated[],
  now: Date,
  name: (id: string | null) => string | null,
  hasTime: (iso: string) => boolean,
): { insight: RadarInsight; entry: Dated } | null {
  const entry = dated.find((d) => d.offset >= 0)
  if (!entry) return null
  const subject = name(entry.item.curriculumSubjectId)
  return {
    entry,
    insight: {
      id: `next-up:${entry.item.id}`,
      kind: 'next-up',
      priority: PRIORITY['next-up'],
      title: entry.item.title,
      reason: withSubject(
        entry.offset === 0 ? 'Es para hoy' : `Es para el ${dayMonth(entry.at)}`,
        subject,
      ),
      target: itemTarget(entry),
      actionLabel: subject ? 'Ir a la materia' : 'Ver en la lista',
      item: entry.item,
      countdown: countdownFor(entry, now, hasTime),
    },
  }
}

function dueNow(
  dated: readonly Dated[],
  skip: string | null,
  name: (id: string | null) => string | null,
): RadarInsight | null {
  const overdue = dated.filter((d) => d.offset < 0)
  const today = dated.filter((d) => d.offset === 0 && d.item.id !== skip)
  const total = overdue.length + today.length
  if (total === 0) return null
  const section = overdue.length > 0 ? 'overdue' : 'today'
  const only = total === 1 ? (overdue[0] ?? today[0]) : undefined
  if (only) {
    const late = only.offset < 0
    return {
      id: `due-now:${only.item.id}`,
      kind: 'due-now',
      priority: PRIORITY['due-now'] + (late ? 50 : 0),
      title: late ? `Atrasada: ${only.item.title}` : `También hoy: ${only.item.title}`,
      reason: withSubject(
        late ? `Venció el ${dayMonth(only.at)}` : 'Vence hoy',
        name(only.item.curriculumSubjectId),
      ),
      target: { kind: 'agenda', section },
      actionLabel: 'Ver en la lista',
      item: only.item,
    }
  }
  const parts: string[] = []
  if (overdue.length > 0) parts.push(countLabel(overdue.length, 'atrasada', 'atrasadas'))
  if (today.length > 0) parts.push(`${today.length} de hoy`)
  return {
    id: 'due-now:many',
    kind: 'due-now',
    priority: PRIORITY['due-now'] + (overdue.length > 0 ? 50 : 0),
    title: overdue.length > 0 ? 'Ponete al día' : `${countLabel(today.length, 'cosa', 'cosas')} más para hoy`,
    reason: parts.join(' · '),
    target: { kind: 'agenda', section },
    actionLabel: 'Ver en la lista',
  }
}

function getAhead(
  dated: readonly Dated[],
  skip: string | null,
  name: (id: string | null) => string | null,
): RadarInsight | null {
  const candidates = dated.filter(
    (d) =>
      d.item.id !== skip &&
      d.offset >= GET_AHEAD_FROM &&
      d.offset <= GET_AHEAD_TO &&
      (WEIGHT[d.item.kind] ?? 0) > 0,
  )
  const best = [...candidates].sort(
    (a, b) => (WEIGHT[b.item.kind] ?? 0) - (WEIGHT[a.item.kind] ?? 0) || a.offset - b.offset,
  )[0]
  if (!best) return null
  const more = candidates.length - 1
  const reason = withSubject(`Faltan ${best.offset} días`, name(best.item.curriculumSubjectId))
  return {
    id: `get-ahead:${best.item.id}`,
    kind: 'get-ahead',
    priority: PRIORITY['get-ahead'] + (WEIGHT[best.item.kind] ?? 0),
    title: `Adelantá ${best.item.title}`,
    reason: more > 0 ? `${reason} · y ${countLabel(more, 'otra', 'otras')} en dos semanas` : reason,
    target: itemTarget(best),
    actionLabel: best.item.curriculumSubjectId ? 'Ir a la materia' : 'Ver en la lista',
    item: best.item,
  }
}

function heavyWeek(dated: readonly Dated[], now: Date): RadarInsight | null {
  const thisWeek = weekStart(now).getTime()
  const weeks = new Map<number, Dated[]>()
  for (const d of dated) {
    if (d.offset < 0 || !EVALUATION_WORDS[d.item.kind]) continue
    const start = weekStart(d.at).getTime()
    // Week index by calendar days, so a DST change cannot shift it.
    const index = Math.round(dayOffset(new Date(thisWeek), new Date(start)) / 7)
    if (index >= HEAVY_WEEK_SPAN) continue
    const bucket = weeks.get(start)
    if (bucket) bucket.push(d)
    else weeks.set(start, [d])
  }
  const heavy = [...weeks.entries()]
    .filter(([, list]) => list.length >= HEAVY_WEEK_MIN)
    .sort(([a], [b]) => a - b)[0]
  if (!heavy) return null
  const [start, list] = heavy
  const counts = new Map<AcademicItemKind, number>()
  for (const d of list) counts.set(d.item.kind, (counts.get(d.item.kind) ?? 0) + 1)
  const words = (['midterm', 'final', 'assignment'] as const)
    .filter((kind) => counts.has(kind))
    .map((kind) => {
      const n = counts.get(kind) ?? 0
      const [one, many] = EVALUATION_WORDS[kind]!
      return `${n} ${plural(n, one, many)}`
    })
  const isThisWeek = start === thisWeek
  return {
    id: `heavy-week:${dayMonth(new Date(start))}`,
    kind: 'heavy-week',
    priority: PRIORITY['heavy-week'] + (isThisWeek ? 20 : 0),
    title: isThisWeek ? 'Semana cargada' : `Semana cargada desde el ${dayMonth(new Date(start))}`,
    reason: `${joinNames(words)} en la misma semana`,
    target: { kind: 'calendar' },
    actionLabel: 'Ver calendario',
  }
}

function hasBookedFinal(subjectId: string, dated: readonly Dated[]): boolean {
  return dated.some(
    (d) => d.offset >= 0 && d.item.kind === 'final' && d.item.curriculumSubjectId === subjectId,
  )
}

function finalToBook(
  subjects: readonly SubjectView[],
  dated: readonly Dated[],
  prerequisitesKnown: boolean,
): RadarInsight | null {
  const first = pendingFinals(subjects).find((p) => !hasBookedFinal(p.subject.id, dated))
  if (!first) return null
  const opens = prerequisitesKnown ? first.opens.length : 0
  return {
    id: `final-to-book:${first.subject.id}`,
    kind: 'final-to-book',
    priority: PRIORITY['final-to-book'] + Math.min(opens, 50),
    title: `Rendí ${first.subject.name}`,
    reason:
      opens > 0
        ? `Habilita el final de ${countLabel(opens, 'materia', 'materias')}`
        : 'La regularizaste y no tiene final agendado',
    target: { kind: 'pending-finals' },
    actionLabel: 'Ver finales',
  }
}

/** Statuses a requirement can be on its way to: the student is doing or did the cursada. */
const ON_ITS_WAY: ReadonlySet<SubjectView['status']> = new Set(['in_progress'])

function unlockSoon(
  subjects: readonly SubjectView[],
  prerequisitesKnown: boolean,
): RadarInsight | null {
  if (!prerequisitesKnown) return null
  const byId = new Map(subjects.map((s) => [s.id, s]))
  const opens = new Map<string, SubjectView[]>()
  for (const subject of subjects) {
    if (subject.status !== 'blocked' || subject.manual) continue
    const missing = new Set(
      subject.missingRequirements
        .filter((r) => r.kind === 'to_take')
        .map((r) => r.curriculumSubjectId),
    )
    if (missing.size !== 1) continue
    const [requiredId] = [...missing] as [string]
    const list = opens.get(requiredId)
    if (list) list.push(subject)
    else opens.set(requiredId, [subject])
  }
  const best = [...opens.entries()]
    .map(([id, list]) => ({ required: byId.get(id), list }))
    .filter((e): e is { required: SubjectView; list: SubjectView[] } => e.required !== undefined)
    .sort(
      (a, b) =>
        b.list.length - a.list.length ||
        Number(ON_ITS_WAY.has(b.required.status)) - Number(ON_ITS_WAY.has(a.required.status)) ||
        a.required.yearLevel - b.required.yearLevel ||
        a.required.displayOrder - b.required.displayOrder ||
        a.required.name.localeCompare(b.required.name, 'es'),
    )[0]
  if (!best) return null
  const names = best.list.map((s) => s.name)
  const n = names.length
  return {
    id: `unlock-soon:${best.required.id}`,
    kind: 'unlock-soon',
    priority: PRIORITY['unlock-soon'] + Math.min(n, 50),
    title:
      n === 1
        ? `Cerca de cursar ${names[0]}`
        : `${best.required.name} te abre ${countLabel(n, 'materia', 'materias')}`,
    reason:
      n === 1
        ? `Solo te falta regularizar ${best.required.name}`
        : `Regularizala y podés cursar ${joinNames(names)}`,
    target: { kind: 'subject', subjectId: best.required.id },
    actionLabel: 'Ir a la materia',
  }
}

/**
 * The Radar's cards, most important first, at most `RADAR_MAX`.
 *
 * `next-up` (the hero) is always first when there is a dated thing ahead; no
 * other card repeats its item.
 */
export function buildRadar(input: RadarInput): RadarInsight[] {
  const { items, subjects, prerequisitesKnown, now } = input
  const hasTime = input.hasTime ?? (() => false)
  const byId = new Map(subjects.map((s) => [s.id, s]))
  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? null) : null)
  const dated = datedOpen(items, now)

  const hero = nextUp(dated, now, name, hasTime)
  const skip = hero?.entry.item.id ?? null
  const due = dueNow(dated, skip, name)
  const insights = [
    hero?.insight ?? null,
    due,
    heavyWeek(dated, now),
    getAhead(dated, skip, name),
    finalToBook(subjects, dated, prerequisitesKnown),
    unlockSoon(subjects, prerequisitesKnown),
  ].filter((insight): insight is RadarInsight => insight !== null)

  const nothingDueNow = !dated.some((d) => d.offset <= 0)
  if (nothingDueNow) {
    insights.push({
      id: 'all-clear',
      kind: 'all-clear',
      priority: PRIORITY['all-clear'],
      title: 'Estás al día',
      reason: hero
        ? `Nada atrasado ni para hoy. Lo próximo es ${inDays(hero.entry.offset)}.`
        : 'Nada atrasado ni para hoy.',
      target: { kind: 'capture' },
      actionLabel: 'Agregar una fecha',
    })
  }

  const seen = new Set<string>()
  return insights
    .filter((insight) => (seen.has(insight.id) ? false : (seen.add(insight.id), true)))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, RADAR_MAX)
}
