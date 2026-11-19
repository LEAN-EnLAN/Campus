import { statusLabel } from './status-groups'
import type {
  AcademicItem,
  AcademicItemKind,
  Resource,
  SubjectStatus,
  SubjectView,
} from './types'

/**
 * CAP-SEARCH-001 — find a materia, task or resource by partial text.
 *
 * Accent- and case-insensitive: an Argentine student types "matematica", the plan
 * says "Análisis Matemático I", and it must match. Pure, no index, no I/O — a
 * curriculum is ~40 subjects, a linear scan is the right amount of machinery.
 *
 * Every entity is searched by more than its title: an entrega by its notes, its
 * materia, its kind ("parcial") and its date the way a student says it
 * ("viernes", "12/11", "noviembre"); a resource by its URL's host and its body.
 */

const DIACRITICS = /[̀-ͯ]/g

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export type SearchResultKind = 'subject' | 'item' | 'resource' | 'note'

export interface SearchResult {
  kind: SearchResultKind
  id: string
  title: string
  subtitle: string | null
  /** Lower is better. */
  score: number
  /** The materia the result belongs to, when it has one (deep links). */
  subjectId?: string | null
  /** For items: the local calendar day it falls on, `YYYY-MM-DD`. */
  date?: string | null
}

export interface SearchInput {
  subjects: readonly SubjectView[]
  items: readonly AcademicItem[]
  resources: readonly Resource[]
  /**
   * Whether the plan's correlativas are known. When they are not, nothing may be
   * called "available": that would claim a subject can be taken on the strength
   * of prerequisites nobody has. Defaults to true.
   */
  prerequisitesKnown?: boolean
}

/** What a student calls each kind of item, and other words they search it by. */
const KIND_WORDS: Record<AcademicItemKind, { label: string; also: string }> = {
  task: { label: 'Tarea', also: '' },
  assignment: { label: 'Entrega', also: 'tp trabajo practico' },
  midterm: { label: 'Parcial', also: 'examen' },
  final: { label: 'Final', also: 'examen' },
  registration: { label: 'Inscripción', also: '' },
  class: { label: 'Clase', also: '' },
  custom: { label: 'Otro', also: '' },
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar day of an ISO instant, `YYYY-MM-DD`. */
export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "viernes 13 de noviembre" — how the date reads in a result. */
function spokenDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()] ?? ''} ${d.getDate()} de ${MONTHS[d.getMonth()] ?? ''}`
}

/** Every way a student might type a date: "viernes", "13/11", "13/11/2026", "noviembre". */
function dateTerms(d: Date): string {
  const dd = d.getDate()
  const mm = d.getMonth() + 1
  const yyyy = d.getFullYear()
  return [
    spokenDate(d),
    `${dd}/${mm}`,
    `${pad(dd)}/${pad(mm)}`,
    `${dd}/${mm}/${yyyy}`,
    `${pad(dd)}/${pad(mm)}/${yyyy}`,
  ].join(' ')
}

/**
 * Score a candidate against the normalised query.
 * Returns null when it does not match at all.
 */
function score(haystack: string, needle: string): number | null {
  const index = haystack.indexOf(needle)
  if (index === -1) return null
  // Prefix beats word-start beats substring; shorter haystacks win ties.
  if (index === 0) return haystack.length
  const before = haystack[index - 1]
  const isWordStart = before === ' ' || before === '/'
  return (isWordStart ? 1000 : 2000) + index + haystack.length
}

/** A match outside the title ranks after any title match of the same quality. */
const SECONDARY = 3000

/** The status as the student reads it. Unknown correlativas never read as "available". */
function statusWording(status: SubjectStatus, prerequisitesKnown: boolean): string {
  return statusLabel(status === 'available' && !prerequisitesKnown ? 'pending' : status)
}

/** URL host without `www.`; null when the URL does not parse. */
export function urlHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Where `query` occurs in `text`, accent- and case-insensitively, as a range of
 * the ORIGINAL text — so the UI can highlight "Matemático" for "matematico".
 */
export function matchRange(text: string, query: string): { start: number; end: number } | null {
  const needle = normalize(query)
  if (needle === '') return null
  let folded = ''
  const origin: number[] = []
  let lastWasSpace = true
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (/\s/.test(ch)) {
      if (!lastWasSpace) {
        folded += ' '
        origin.push(i)
      }
      lastWasSpace = true
      continue
    }
    lastWasSpace = false
    for (const piece of ch.normalize('NFD').replace(DIACRITICS, '').toLowerCase()) {
      folded += piece
      origin.push(i)
    }
  }
  const at = folded.indexOf(needle)
  if (at === -1) return null
  const start = origin[at] ?? 0
  const last = origin[at + needle.length - 1] ?? start
  return { start, end: last + 1 }
}

/** About `width` characters of `text` around the match, with ellipses. */
function snippet(text: string, query: string, width = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const range = matchRange(flat, query)
  if (!range || flat.length <= width) return flat
  const from = Math.max(0, range.start - Math.floor((width - (range.end - range.start)) / 2))
  const to = Math.min(flat.length, from + width)
  return `${from > 0 ? '…' : ''}${flat.slice(from, to)}${to < flat.length ? '…' : ''}`
}

export function search(
  { subjects, items, resources, prerequisitesKnown = true }: SearchInput,
  query: string,
  limit = 20,
): SearchResult[] {
  const needle = normalize(query)
  if (needle.length < 2) return []

  const results: SearchResult[] = []
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]))
  const materiaOf = (id: string | null) => (id ? (subjectName.get(id) ?? null) : null)

  for (const subject of subjects) {
    const s =
      score(subject.normalizedName, needle) ??
      (subject.code ? score(normalize(subject.code), needle) : null)
    if (s === null) continue
    results.push({
      kind: 'subject',
      id: subject.id,
      title: subject.name,
      subtitle: `${subject.yearLevel}° año · ${statusWording(subject.status, prerequisitesKnown)}`,
      score: s,
      subjectId: subject.id,
    })
  }

  for (const item of items) {
    const when = item.dueAt ?? item.startsAt
    const date = when ? new Date(when) : null
    const materia = materiaOf(item.curriculumSubjectId)
    const kind = KIND_WORDS[item.kind]

    const titleScore = score(normalize(item.title), needle)
    const contextScore =
      titleScore === null
        ? score(
            normalize([kind.label, kind.also, materia ?? '', date ? dateTerms(date) : ''].join(' ')),
            needle,
          )
        : null
    const notesScore =
      titleScore === null && contextScore === null && item.notes
        ? score(normalize(item.notes), needle)
        : null
    const best = titleScore ?? contextScore ?? notesScore
    if (best === null) continue

    const parts = [kind.label, materia, date ? spokenDate(date) : null].filter(
      (p): p is string => p !== null,
    )
    results.push({
      kind: 'item',
      id: item.id,
      title: item.title,
      subtitle: notesScore !== null && item.notes ? snippet(item.notes, query) : parts.join(' · '),
      // Subjects outrank items at equal quality.
      score: (titleScore ?? best + SECONDARY) + 1,
      subjectId: item.curriculumSubjectId,
      date: when ? localDay(when) : null,
    })
  }

  for (const resource of resources) {
    const host = urlHost(resource.url)
    const materia = materiaOf(resource.curriculumSubjectId)
    const titleScore = score(normalize(resource.title), needle)
    const hostScore = titleScore === null && host ? score(normalize(host), needle) : null
    const bodyScore =
      titleScore === null && hostScore === null && resource.body
        ? score(normalize(resource.body), needle)
        : null
    const best = titleScore ?? hostScore ?? bodyScore
    if (best === null) continue

    const where =
      host ?? (resource.kind === 'file' ? 'Archivo' : resource.kind === 'note' ? 'Texto' : null)
    const meta = [materia, where].filter((p): p is string => p !== null).join(' · ')
    results.push({
      kind: 'resource',
      id: resource.id,
      title: resource.title,
      subtitle:
        bodyScore !== null && resource.body ? snippet(resource.body, query) : meta || null,
      score: (titleScore ?? best + SECONDARY) + 2,
      subjectId: resource.curriculumSubjectId,
    })
  }

  return results
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'es'))
    .slice(0, limit)
}

/** The order groups appear in, and what each is called. */
const GROUPS: readonly { kind: SearchResultKind; label: string }[] = [
  { kind: 'subject', label: 'Materias' },
  { kind: 'item', label: 'Entregas y fechas' },
  { kind: 'resource', label: 'Material' },
  { kind: 'note', label: 'Notas' },
]

export interface SearchGroup {
  kind: SearchResultKind
  label: string
  results: SearchResult[]
}

/** Results grouped by type, in a fixed order, empty groups dropped. */
export function groupResults(results: readonly SearchResult[]): SearchGroup[] {
  return GROUPS.map(({ kind, label }) => ({
    kind,
    label,
    results: results.filter((r) => r.kind === kind),
  })).filter((group) => group.results.length > 0)
}

/** What the note index hands back for a query: a path, a title, a line of context. */
export interface NoteHit {
  path: string
  title: string
  snippet: string
}

/**
 * Notes as search results. Notes live in the Vault, not in the academic model,
 * so they are found by the note index and only SHAPED here: the result's `id`
 * is the vault path (what the workspace opens), and the subtitle is the matching
 * line, or the folder when there is none. The `.md` extension is never shown.
 */
export function noteResults(hits: readonly NoteHit[], limit = 8): SearchResult[] {
  return hits.slice(0, limit).map((hit, rank) => {
    const slash = hit.path.lastIndexOf('/')
    const folder = slash === -1 ? null : hit.path.slice(0, slash)
    return {
      kind: 'note',
      id: hit.path,
      title: hit.title,
      subtitle: hit.snippet !== '' ? hit.snippet : folder,
      // After every academic result; the index already ranked these among themselves.
      score: 10_000 + rank,
    }
  })
}
