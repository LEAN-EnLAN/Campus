import type { AcademicItem } from '@/domain/types'

import { anchorOf, hasUserTime } from './due'
import { shareText } from './share'

/**
 * Items as iCalendar (RFC 5545), for Google Calendar, Outlook or the phone's own.
 *
 * - One VEVENT per dated item, UID stable per item: importing twice updates
 *   the event instead of duplicating it.
 * - A time the student typed is written as Buenos Aires wall time with its
 *   TZID (and the VTIMEZONE the RFC requires next to it). A date with no time
 *   is an all-day event (`VALUE=DATE`): writing the 23:59 that stands in for
 *   "no time" would invent a deadline hour.
 * - SUMMARY is the same line "Copiar para WhatsApp" writes; the title goes in
 *   DESCRIPTION. Notes never leave Campus this way.
 * - CRLF line ends, lines folded at 75 octets, TEXT escaped.
 */

export const ICS_TZID = 'America/Argentina/Buenos_Aires'

/** Argentina has kept UTC−3 all year since 2009. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ICS_TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:-0300',
  'TZOFFSETTO:-0300',
  'TZNAME:-03',
  'END:STANDARD',
  'END:VTIMEZONE',
]

const WALL_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: ICS_TZID,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const pad = (n: number) => String(n).padStart(2, '0')

/** Why an item cannot be exported, or null when it can. */
export function icsUnavailableReason(
  item: Pick<AcademicItem, 'dueAt' | 'startsAt'>,
): string | null {
  return anchorOf(item) ? null : 'Sin fecha: no hay nada para agendar.'
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** RFC 5545 §3.1: at most 75 octets per line, never splitting a character. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    const limit = parts.length === 0 ? 75 : 74 // continuation lines start with a space
    if (size + bytes > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function buenosAiresWallTime(date: Date): string {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    WALL_TIME.formatToParts(date).find((p) => p.type === type)?.value ?? '00'
  return `${part('year')}${part('month')}${part('day')}T${part('hour')}${part('minute')}${part('second')}`
}

/** The day the student meant, in their own calendar. */
function localDay(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

function eventLines(
  item: AcademicItem,
  subjectName: string | null,
  now: Date,
): string[] | null {
  const anchor = anchorOf(item)
  if (!anchor) return null
  const date = new Date(anchor)
  if (Number.isNaN(date.getTime())) return null
  return [
    'BEGIN:VEVENT',
    `UID:campus-item-${item.id}@campus`,
    `DTSTAMP:${utcStamp(now)}`,
    hasUserTime(anchor)
      ? `DTSTART;TZID=${ICS_TZID}:${buenosAiresWallTime(date)}`
      : `DTSTART;VALUE=DATE:${localDay(date)}`,
    `SUMMARY:${escapeText(shareText(item, subjectName))}`,
    `DESCRIPTION:${escapeText(item.title)}`,
    'END:VEVENT',
  ]
}

/** A calendar with every dated item; undated ones are left out. */
export function itemsToIcs(
  items: readonly AcademicItem[],
  subjectName: (item: AcademicItem) => string | null,
  now: Date = new Date(),
): string {
  const events = items.flatMap((item) => eventLines(item, subjectName(item), now) ?? [])
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Campus//Campus//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
    ...events,
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** One item as its own calendar file. */
export function itemToIcs(
  item: AcademicItem,
  subjectName: string | null,
  now: Date = new Date(),
): string {
  return itemsToIcs([item], () => subjectName, now)
}

/** `tp-4-de-analisis.ics` — readable, and safe on every file system. */
export function icsFileName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'fecha'}.ics`
}
