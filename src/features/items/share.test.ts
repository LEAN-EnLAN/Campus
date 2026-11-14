import { afterEach, describe, expect, it } from 'vitest'

import type { AcademicItem } from '@/domain/types'

import { dateOnlyDueAt } from './due'
import {
  acceptSharedCapture,
  clearPendingCapture,
  newShareRef,
  parseSharedCapture,
  PENDING_CAPTURE_KEY,
  readPendingCapture,
  resolveSharedCapture,
  shareLink,
  shareMessage,
  shareText,
} from './share'

const item = (over: Partial<AcademicItem> = {}): AcademicItem => ({
  id: 'item-7f3a',
  curriculumSubjectId: 'sistemas-operativos-14',
  kind: 'midterm',
  title: 'Primer parcial',
  startsAt: null,
  // Wednesday 18/11/2026, 18:30 local.
  dueAt: new Date(2026, 10, 18, 18, 30).toISOString(),
  status: 'open',
  notes: 'Entra hasta memoria virtual. Mi DNI 12345678',
  ...over,
})

const ORIGIN = 'https://campus.example'

describe('the WhatsApp line', () => {
  it('reads "<Tipo> · <Materia> · <día dd/mm HH:mm>"', () => {
    expect(shareText(item(), 'Sistemas Operativos')).toBe(
      'Parcial · Sistemas Operativos · mié 18/11 18:30',
    )
  })

  it('drops the subject segment when there is no subject', () => {
    expect(shareText(item({ curriculumSubjectId: null }), null)).toBe(
      'Parcial · mié 18/11 18:30',
    )
  })

  it('writes only dd/mm when the student set no time', () => {
    expect(shareText(item({ dueAt: dateOnlyDueAt(2026, 11, 18) }), 'Sistemas Operativos')).toBe(
      'Parcial · Sistemas Operativos · 18/11',
    )
  })

  it('has no date segment for an undated item', () => {
    expect(shareText(item({ dueAt: null }), 'Física I')).toBe('Parcial · Física I')
  })
})

describe('the shared link', () => {
  it('carries kind, title, due, subject, its name and a ref, under /add', () => {
    const link = new URL(
      shareLink(item(), {
        origin: ORIGIN,
        subjectName: 'Sistemas Operativos',
        ref: 'Ab3_x-9Qz',
      }),
    )

    expect(link.origin + link.pathname).toBe(`${ORIGIN}/add`)
    expect(Object.fromEntries(link.searchParams)).toEqual({
      kind: 'midterm',
      title: 'Primer parcial',
      due: item().dueAt,
      subject: 'sistemas-operativos-14',
      subjectName: 'Sistemas Operativos',
      ref: 'Ab3_x-9Qz',
    })
  })

  it('never carries notes, the item id or anything about the sender', () => {
    const message = shareMessage(item(), {
      origin: ORIGIN,
      subjectName: 'Sistemas Operativos',
      ref: newShareRef(),
    })

    expect(message).not.toContain('item-7f3a')
    expect(message).not.toContain('memoria')
    expect(message).not.toContain('12345678')
    const params = new URL(message.split('\n')[1] ?? '').searchParams
    expect([...params.keys()].sort()).toEqual(
      ['due', 'kind', 'ref', 'subject', 'subjectName', 'title'].sort(),
    )
  })

  it('leaves out subject and due when the item has neither', () => {
    const link = new URL(
      shareLink(item({ curriculumSubjectId: null, dueAt: null }), {
        origin: `${ORIGIN}/`,
        subjectName: null,
        ref: 'abcdefgh',
      }),
    )

    expect(link.pathname).toBe('/add')
    expect([...link.searchParams.keys()]).toEqual(['kind', 'title', 'ref'])
  })

  it('puts the line first and the link on the next one', () => {
    const [line, link] = shareMessage(item(), {
      origin: ORIGIN,
      subjectName: 'Sistemas Operativos',
      ref: 'abcdefgh',
    }).split('\n')

    expect(line).toBe('Parcial · Sistemas Operativos · mié 18/11 18:30')
    expect(link).toMatch(/^https:\/\/campus\.example\/add\?/)
  })
})

describe('the ref', () => {
  it('is fresh on every copy and URL-safe', () => {
    const a = newShareRef()
    const b = newShareRef()

    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,32}$/)
    expect(b).toMatch(/^[A-Za-z0-9_-]{8,32}$/)
  })
})

describe('reading /add', () => {
  const full = () =>
    new URL(
      shareLink(item(), {
        origin: ORIGIN,
        subjectName: 'Sistemas Operativos',
        ref: 'abcdefgh',
      }),
    ).search

  it('reads back everything a valid link carries', () => {
    expect(parseSharedCapture(full())).toEqual({
      title: 'Primer parcial',
      kind: 'midterm',
      dueAt: item().dueAt,
      subjectId: 'sistemas-operativos-14',
      subjectName: 'Sistemas Operativos',
      ref: 'abcdefgh',
    })
  })

  it('drops a malformed date and keeps the rest', () => {
    const capture = parseSharedCapture('?title=TP%201&kind=assignment&due=18%2F11%2F2026')

    expect(capture.dueAt).toBeNull()
    expect(capture.title).toBe('TP 1')
    expect(capture.kind).toBe('assignment')
  })

  it('drops an impossible date', () => {
    expect(parseSharedCapture('?due=2026-13-45T10:00:00Z').dueAt).toBeNull()
  })

  it('drops a kind outside the enum', () => {
    const capture = parseSharedCapture('?title=TP&kind=examen')

    expect(capture.kind).toBeNull()
    expect(capture.title).toBe('TP')
  })

  it('drops an empty title and one over 200 characters', () => {
    expect(parseSharedCapture('?title=%20%20&kind=final').title).toBeNull()
    expect(parseSharedCapture(`?title=${'a'.repeat(201)}`).title).toBeNull()
    expect(parseSharedCapture(`?title=${'a'.repeat(200)}`).title).toHaveLength(200)
  })

  it('drops a ref that is not 8–32 URL-safe characters', () => {
    expect(parseSharedCapture('?title=x&ref=short').ref).toBeNull()
    expect(parseSharedCapture('?title=x&ref=has%20space%20in').ref).toBeNull()
  })
})

describe('resolving the subject on the receiving side', () => {
  const capture = {
    title: 'Primer parcial',
    kind: 'midterm' as const,
    dueAt: null,
    subjectId: 'sistemas-operativos-14',
    subjectName: 'Sistemas Operativos',
    ref: 'abcdefgh',
  }

  it('preselects the subject when the same id is in the plan', () => {
    expect(resolveSharedCapture(capture, [{ id: 'sistemas-operativos-14' }])).toMatchObject({
      title: 'Primer parcial',
      curriculumSubjectId: 'sistemas-operativos-14',
    })
  })

  it('leaves it empty and names it in the title when the plan does not have it', () => {
    expect(resolveSharedCapture(capture, [{ id: 'algebra-2' }])).toMatchObject({
      title: 'Primer parcial (Sistemas Operativos)',
      curriculumSubjectId: null,
    })
  })

  it('never matches a subject by its name', () => {
    const resolved = resolveSharedCapture(capture, [
      { id: 'otro-id', name: 'Sistemas Operativos' } as { id: string },
    ])

    expect(resolved.curriculumSubjectId).toBeNull()
  })

  it('keeps the title as is when no subject was shared', () => {
    expect(
      resolveSharedCapture({ ...capture, subjectId: null, subjectName: null }, []).title,
    ).toBe('Primer parcial')
  })
})

describe('the hand-off to Hoy', () => {
  afterEach(() => window.sessionStorage.clear())

  it('keeps the checked draft, ref included, under campus.pendingCapture', () => {
    acceptSharedCapture('?title=TP%201&kind=assignment&ref=abcdefgh&notes=secreto')

    const stored = JSON.parse(window.sessionStorage.getItem(PENDING_CAPTURE_KEY) ?? '{}')
    expect(stored).toMatchObject({ title: 'TP 1', kind: 'assignment', ref: 'abcdefgh' })
    expect(JSON.stringify(stored)).not.toContain('secreto')
    expect(readPendingCapture()).toMatchObject({ title: 'TP 1', ref: 'abcdefgh' })
  })

  it('stores nothing when the link carried nothing usable', () => {
    acceptSharedCapture('?kind=examen&due=mañana')

    expect(window.sessionStorage.getItem(PENDING_CAPTURE_KEY)).toBeNull()
  })

  it('checks the stored draft again and ignores junk', () => {
    window.sessionStorage.setItem(PENDING_CAPTURE_KEY, '{"kind":"hack","title":""}')
    expect(readPendingCapture()).toBeNull()

    window.sessionStorage.setItem(PENDING_CAPTURE_KEY, 'not json')
    expect(readPendingCapture()).toBeNull()
  })

  it('is gone once cleared', () => {
    acceptSharedCapture('?title=TP')
    clearPendingCapture()

    expect(readPendingCapture()).toBeNull()
  })
})
