import type { ResourceKind } from './types'

/**
 * Material drafts: turning whatever the student drops, pastes or types into a
 * link or a note Campus can save.
 *
 * Pure and deterministic — no network, no clipboard, no DOM. A title "guessed"
 * from a URL comes from the URL alone, so the same link always suggests the
 * same title and the student can always edit it.
 */

/** What Campus can store today. `file` has no storage path yet. */
export type DraftKind = Extract<ResourceKind, 'link' | 'note'>

export interface ResourceDraft {
  kind: DraftKind
  title: string
  url: string
  body: string
}

export type ValidResource =
  | { kind: 'link'; title: string; url: string; body: null }
  /** A title-only note keeps `body: ''`: the resources table refuses a note whose body is null. */
  | { kind: 'note'; title: string; url: null; body: string }

export interface DraftErrors {
  title?: string
  url?: string
}

export type DraftValidation =
  { ok: true; value: ValidResource } | { ok: false; errors: DraftErrors }

/** What arrived through a drop or a paste, before anything is saved. */
export type IncomingContent =
  | { kind: 'link'; url: string; title: string }
  | { kind: 'note'; body: string; title: string }
  | { kind: 'file' }
  | { kind: 'empty' }

export interface IncomingPayload {
  /** `text/uri-list`, as the browser hands it over. */
  uriList?: string
  /** `text/plain`. */
  text?: string
  /** Number of files carried along (dragged from the desktop, pasted images…). */
  fileCount?: number
}

export const EMPTY_DRAFT: ResourceDraft = { kind: 'link', title: '', url: '', body: '' }

const HTTP_URL = /^https?:\/\/\S+$/i
const NOTE_TITLE_MAX = 60

/** Same rule the inline form always had: http(s), no spaces — and it must parse. */
export function isHttpUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!HTTP_URL.test(trimmed)) return false
  try {
    const url = new URL(trimmed)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

/**
 * The URL a piece of text *is*, or null.
 *
 * Only text that is entirely one URL counts — a sentence that mentions a link is
 * a note, not a link. `text/uri-list` may carry `#` comment lines and several
 * URLs; the first real one wins.
 */
export function extractHttpUrl(text: string): string | null {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'))
  if (!firstLine) return null
  return isHttpUrl(firstLine) ? firstLine : null
}

/** `www.campus.unr.edu.ar` → `campus.unr.edu.ar`. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

/** Path segments that never name the material. */
const GENERIC_SEGMENTS = new Set([
  'd',
  'u',
  'edit',
  'view',
  'preview',
  'index',
  'home',
  'default',
  'main',
  'download',
  'file',
  'files',
  'document',
  'documents',
  'pub',
  'share',
  'watch',
  'open',
  'login',
])

/** Opaque ids (Drive, Docs, hashes): long, no separators, letters and digits mixed. */
function looksLikeId(segment: string): boolean {
  if (/^\d+$/.test(segment)) return true
  if (segment.length < 16 || /[\s_-]/.test(segment)) return false
  return /\d/.test(segment) && /[a-z]/i.test(segment)
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1)
}

/**
 * A readable title from a URL alone.
 *
 * Walks the path from the end and keeps the first segment that means something:
 * decoded, extension stripped, slug separators turned into spaces. Falls back to
 * the host without `www.`.
 *
 * `…/apuntes/analisis-matematico_II.pdf` → `Analisis matematico II`
 */
export function titleFromUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url.trim()
  }

  const segments = parsed.pathname.split('/').filter(Boolean).reverse()
  for (const raw of segments) {
    const decoded = safeDecode(raw).trim()
    const withoutExtension = decoded.replace(/\.[a-z0-9]{1,5}$/i, '')
    if (GENERIC_SEGMENTS.has(withoutExtension.toLowerCase())) continue
    if (looksLikeId(withoutExtension)) continue
    const words = withoutExtension
      .replace(/[-_+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (words.length < 2) continue
    return capitalise(words)
  }

  return hostLabel(url)
}

/** First line of a note, trimmed to a title-sized phrase at a word boundary. */
export function titleFromText(text: string): string {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .find((line) => line !== '') ?? ''
  if (firstLine.length <= NOTE_TITLE_MAX) return firstLine
  const cut = firstLine.slice(0, NOTE_TITLE_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * What a drop or paste carries.
 *
 * Files win over text: a dragged PDF usually also exposes its name as text, and
 * saving that name as a note would quietly lose the file the student meant.
 */
export function classifyIncoming(payload: IncomingPayload): IncomingContent {
  if ((payload.fileCount ?? 0) > 0) return { kind: 'file' }

  const fromUriList = payload.uriList ? extractHttpUrl(payload.uriList) : null
  const text = payload.text?.trim() ?? ''
  const url = fromUriList ?? extractHttpUrl(text)
  if (url) return { kind: 'link', url, title: titleFromUrl(url) }

  if (text !== '') return { kind: 'note', body: text, title: titleFromText(text) }
  return { kind: 'empty' }
}

/** The draft an incoming link or note becomes. Nothing is saved. */
export function draftFromIncoming(
  incoming: Extract<IncomingContent, { kind: 'link' | 'note' }>,
): ResourceDraft {
  return incoming.kind === 'link'
    ? { kind: 'link', title: incoming.title, url: incoming.url, body: '' }
    : { kind: 'note', title: incoming.title, url: '', body: incoming.body }
}

export function validateDraft(draft: ResourceDraft): DraftValidation {
  const title = draft.title.trim()
  const errors: DraftErrors = {}
  if (title === '') errors.title = 'Poné un título para el material.'

  if (draft.kind === 'link') {
    const url = draft.url.trim()
    if (!isHttpUrl(url)) errors.url = 'Ingresá un link que empiece con https:// o http://.'
    if (errors.title || errors.url) return { ok: false, errors }
    return { ok: true, value: { kind: 'link', title, url, body: null } }
  }

  if (errors.title) return { ok: false, errors }
  const body = draft.body.trim()
  return {
    ok: true,
    value: { kind: 'note', title, url: null, body },
  }
}
