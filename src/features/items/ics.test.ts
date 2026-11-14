import { describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { dateOnlyDueAt } from './due'
import { escapeText, icsFileName, icsUnavailableReason, itemsToIcs, itemToIcs } from './ics'
import { shareText } from './share'

const NOW = new Date('2026-11-13T15:04:05.000Z')

const item = (over: Partial<AcademicItem> = {}): AcademicItem => ({
  id: 'a1',
  curriculumSubjectId: 'so',
  kind: 'midterm',
  title: 'Primer parcial',
  startsAt: null,
  dueAt: dateOnlyDueAt(2026, 11, 18),
  status: 'open',
  notes: 'nunca sale',
  ...over,
})

/** RFC 5545 §3.1 unfolding: CRLF followed by one space joins lines. */
const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('one item as .ics', () => {
  it('matches the snapshot: VCALENDAR, VTIMEZONE, one VEVENT, CRLF', () => {
    expect(itemToIcs(item(), 'Sistemas Operativos', NOW)).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Campus//Campus//ES',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VTIMEZONE',
        'TZID:America/Argentina/Buenos_Aires',
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:-0300',
        'TZOFFSETTO:-0300',
        'TZNAME:-03',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'UID:campus-item-a1@campus',
        'DTSTAMP:20261113T150405Z',
        'DTSTART;VALUE=DATE:20261118',
        'SUMMARY:Parcial · Sistemas Operativos · 18/11',
        'DESCRIPTION:Primer parcial',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n'),
    )
  })

  it('writes a typed time as Buenos Aires wall time with its TZID', () => {
    // 21:30 UTC is 18:30 in Buenos Aires (UTC−3), whatever this machine's zone.
    const timed = item({ dueAt: '2026-11-18T21:30:00.000Z' })
    const ics = itemToIcs(timed, 'Sistemas Operativos', NOW)

    expect(ics).toContain('DTSTART;TZID=America/Argentina/Buenos_Aires:20261118T183000\r\n')
    // SUMMARY is exactly the WhatsApp line.
    expect(unfold(ics)).toContain(`SUMMARY:${shareText(timed, 'Sistemas Operativos')}\r\n`)
  })

  it('keeps the same UID for the same item, so a re-import updates it', () => {
    const first = itemToIcs(item(), null, NOW)
    const second = itemToIcs(item({ title: 'Parcial (cambió)' }), null, new Date())

    const uid = (ics: string) => /UID:(.+)\r\n/.exec(ics)?.[1]
    expect(uid(first)).toBe(uid(second))
  })

  it('uses CRLF and never a bare LF', () => {
    const ics = itemToIcs(item({ title: 'línea 1\nlínea 2' }), null, NOW)

    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('leaves notes out', () => {
    expect(itemToIcs(item(), null, NOW)).not.toContain('nunca sale')
  })
})

describe('escaping and folding', () => {
  it('escapes backslash, semicolon, comma and line breaks', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  it('escapes them inside SUMMARY and DESCRIPTION', () => {
    const ics = unfold(
      itemToIcs(item({ title: 'TP; parte 1, 2\\3' }), 'Física I, comisión; A\\B', NOW),
    )

    expect(ics).toContain('SUMMARY:Parcial · Física I\\, comisión\\; A\\\\B · 18/11\r\n')
    expect(ics).toContain('DESCRIPTION:TP\\; parte 1\\, 2\\\\3\r\n')
  })

  it('folds lines at 75 octets without splitting a character', () => {
    const long = 'Álgebra y Geometría Analítica — ñandú '.repeat(5)
    const ics = itemToIcs(item({ title: long }), null, NOW)
    const encoder = new TextEncoder()

    for (const line of ics.split('\r\n')) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(ics).not.toContain('\uFFFD')
    expect(unfold(ics)).toContain(`DESCRIPTION:${long.replace(/,/g, '\\,')}\r\n`)
  })
})

describe('many items', () => {
  it('writes one VEVENT per dated item and skips the undated', () => {
    const ics = itemsToIcs(
      [item({ id: 'a' }), item({ id: 'b', dueAt: null }), item({ id: 'c' })],
      () => null,
      NOW,
    )

    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('UID:campus-item-a@campus')
    expect(ics).not.toContain('UID:campus-item-b@campus')
  })
})

describe('when there is nothing to export', () => {
  it('says why for an undated item, and nothing for a dated one', () => {
    expect(icsUnavailableReason(item({ dueAt: null }))).toMatch(/Sin fecha/)
    expect(icsUnavailableReason(item())).toBeNull()
  })
})

describe('file name', () => {
  it('is a readable slug', () => {
    expect(icsFileName('TP 4 de Análisis Matemático II')).toBe(
      'tp-4-de-analisis-matematico-ii.ics',
    )
    expect(icsFileName('¿?')).toBe('fecha.ics')
  })
})
