import { itemKindLabel } from './kind-label'
import type { AcademicItem, AcademicItemKind } from '@/domain/types'

import { anchorOf, hasUserTime } from './due'

/**
 * "Copiar para WhatsApp" and the `/add` link it carries.
 *
 * The link is a capture form filled in advance, nothing more: kind, title, date
 * and the subject as the sender's plan calls it. It never carries notes, the
 * sender's id or the item's id — whoever opens it gets a draft they have to
 * confirm, in their own plan.
 */

const KINDS: readonly AcademicItemKind[] = [
  'task',
  'assignment',
  'midterm',
  'final',
  'registration',
  'class',
  'custom',
]

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const
const pad = (n: number) => String(n).padStart(2, '0')

/** The longest title the capture form accepts from a link. */
export const SHARED_TITLE_MAX = 200
const SUBJECT_MAX = 200
const REF = /^[A-Za-z0-9_-]{8,32}$/
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/

/** When, the way it reads in a chat: `mié 18/11 18:30`, or `18/11` with no time. */
function whenLabel(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`
  if (!hasUserTime(iso)) return day
  return `${WEEKDAYS[date.getDay()]} ${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * `Parcial · Sistemas Operativos · mié 18/11 18:30`. No subject, no segment;
 * no date, no segment. Also the SUMMARY of the item's `.ics`.
 */
export function shareText(
  item: Pick<AcademicItem, 'kind' | 'dueAt' | 'startsAt'>,
  subjectName: string | null,
): string {
  const anchor = anchorOf(item)
  return [itemKindLabel(item.kind), subjectName, anchor ? whenLabel(anchor) : null]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

/** 12 random URL-safe characters, fresh on every copy. Never derived from the student. */
export function newShareRef(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (byte) => alphabet[byte % 64]).join('')
}

/** `<origin>/add?kind=…&title=…&due=…&subject=…&subjectName=…&ref=…` */
export function shareLink(
  item: Pick<AcademicItem, 'kind' | 'title' | 'dueAt' | 'startsAt' | 'curriculumSubjectId'>,
  { origin, subjectName, ref }: { origin: string; subjectName: string | null; ref: string },
): string {
  const params = new URLSearchParams()
  params.set('kind', item.kind)
  params.set('title', item.title)
  const anchor = anchorOf(item)
  if (anchor) params.set('due', anchor)
  if (item.curriculumSubjectId) params.set('subject', item.curriculumSubjectId)
  if (subjectName) params.set('subjectName', subjectName)
  params.set('ref', ref)
  return `${origin.replace(/\/+$/, '')}/add?${params.toString()}`
}

/** What lands in the clipboard: the line, then the link. */
export function shareMessage(
  item: Pick<AcademicItem, 'kind' | 'title' | 'dueAt' | 'startsAt' | 'curriculumSubjectId'>,
  options: { origin: string; subjectName: string | null; ref: string },
): string {
  return `${shareText(item, options.subjectName)}\n${shareLink(item, options)}`
}

// ─── Receiving a shared link ────────────────────────────────────────────────

/** A shared capture, every field already checked. Absent or invalid is null. */
export interface PendingCapture {
  title: string | null
  kind: AcademicItemKind | null
  dueAt: string | null
  subjectId: string | null
  subjectName: string | null
  ref: string | null
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > max || CONTROL.test(trimmed)) return null
  return trimmed
}

function instant(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** Each field on its own: a bad date drops the date, not the whole draft. */
function sanitize(raw: Record<string, unknown>): PendingCapture {
  const kind = raw.kind
  const ref = raw.ref
  return {
    title: text(raw.title, SHARED_TITLE_MAX),
    kind: KINDS.includes(kind as AcademicItemKind) ? (kind as AcademicItemKind) : null,
    dueAt: instant(raw.dueAt),
    subjectId: text(raw.subjectId, SUBJECT_MAX),
    subjectName: text(raw.subjectName, SUBJECT_MAX),
    ref: typeof ref === 'string' && REF.test(ref) ? ref : null,
  }
}

/** Read `/add`'s query string. Unknown parameters are ignored. */
export function parseSharedCapture(search: string): PendingCapture {
  const params = new URLSearchParams(search)
  return sanitize({
    title: params.get('title'),
    kind: params.get('kind'),
    dueAt: params.get('due'),
    subjectId: params.get('subject'),
    subjectName: params.get('subjectName'),
    ref: params.get('ref'),
  })
}

/** True when the link carried anything worth opening the form for. */
export function hasSharedContent(capture: PendingCapture): boolean {
  return (
    capture.title !== null ||
    capture.kind !== null ||
    capture.dueAt !== null ||
    capture.subjectId !== null ||
    capture.subjectName !== null
  )
}

export interface SharedCaptureValues {
  title: string
  kind: AcademicItemKind | null
  curriculumSubjectId: string | null
  dueAt: string | null
}

/**
 * The form a receiver sees. The subject is preselected only when the SAME id
 * exists in their plan; otherwise it stays empty and its name rides in the
 * title. A subject is never guessed by name.
 */
export function resolveSharedCapture(
  capture: PendingCapture,
  subjects: readonly { id: string }[],
): SharedCaptureValues {
  const known =
    capture.subjectId !== null && subjects.some((subject) => subject.id === capture.subjectId)
  const title = capture.title ?? ''
  return {
    title: !known && capture.subjectName && title ? `${title} (${capture.subjectName})` : title,
    kind: capture.kind,
    curriculumSubjectId: known ? capture.subjectId : null,
    dueAt: capture.dueAt,
  }
}

// ─── Hand-off between `/add` and Hoy ────────────────────────────────────────

export const PENDING_CAPTURE_KEY = 'campus.pendingCapture'

/** Keep a shared draft until Hoy opens it. Storage may be unavailable: then it is lost, quietly. */
export function storePendingCapture(capture: PendingCapture): void {
  try {
    window.sessionStorage.setItem(PENDING_CAPTURE_KEY, JSON.stringify(capture))
  } catch {
    /* private mode or blocked storage */
  }
}

/** The stored draft, checked again: session storage is not trusted input either. */
export function readPendingCapture(): PendingCapture | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_CAPTURE_KEY)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return null
    const capture = sanitize(parsed as Record<string, unknown>)
    return hasSharedContent(capture) ? capture : null
  } catch {
    return null
  }
}

export function clearPendingCapture(): void {
  try {
    window.sessionStorage.removeItem(PENDING_CAPTURE_KEY)
  } catch {
    /* nothing to clear */
  }
}

/** `/add`: keep what the link carried, if anything. */
export function acceptSharedCapture(search: string): void {
  const capture = parseSharedCapture(search)
  if (hasSharedContent(capture)) storePendingCapture(capture)
}

/**
 * Where a shared link points. A desktop build serves the app from
 * `campus.localhost`, which nobody else can open, so a build can name its
 * public address with `VITE_PUBLIC_APP_URL`; otherwise, this page's origin.
 */
export function shareOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  return configured || window.location.origin
}
