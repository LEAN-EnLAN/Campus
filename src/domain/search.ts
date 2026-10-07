import { statusLabel } from './status-groups'
import type { AcademicItem, Resource, SubjectStatus, SubjectView } from './types'

/**
 * CAP-SEARCH-001 — find a materia, task or resource by partial text.
 *
 * Accent- and case-insensitive: an Argentine student types "matematica", the plan
 * says "Análisis Matemático I", and it must match. Pure, no index, no I/O — a
 * curriculum is ~40 subjects, a linear scan is the right amount of machinery.
 */

/** Lowercase, strip diacritics, collapse whitespace. */
export function normalize(text: string): string {
  return (
    text
      .normalize('NFD')
      // Combining diacritical marks — written as escapes so the source stays ASCII.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export type SearchResultKind = 'subject' | 'item' | 'resource' | 'note'

export interface SearchResult {
  kind: SearchResultKind
  id: string
  title: string
  subtitle: string | null
  /** Lower is better. */
  score: number
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

/**
 * Score a candidate against the normalised query.
 * Returns null when it does not match at all.
 */
function score(haystack: string, needle: string): number | null {
  const index = haystack.indexOf(needle)
  if (index === -1) return null
  // Prefix beats word-start beats substring; shorter haystacks win ties.
  if (index === 0) return haystack.length
  const isWordStart = haystack[index - 1] === ' '
  return (isWordStart ? 1000 : 2000) + index + haystack.length
}

/** The status as the student reads it. Unknown correlativas never read as "available". */
function statusWording(status: SubjectStatus, prerequisitesKnown: boolean): string {
  return statusLabel(status === 'available' && !prerequisitesKnown ? 'pending' : status)
}

export function search(
  { subjects, items, resources, prerequisitesKnown = true }: SearchInput,
  query: string,
  limit = 20,
): SearchResult[] {
  const needle = normalize(query)
  if (needle.length < 2) return []

  const results: SearchResult[] = []

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
    })
  }

  for (const item of items) {
    const s = score(normalize(item.title), needle)
    if (s === null) continue
    results.push({
      kind: 'item',
      id: item.id,
      title: item.title,
      subtitle: item.dueAt ? new Date(item.dueAt).toLocaleDateString('es-AR') : null,
      score: s + 1, // subjects outrank items at equal quality
    })
  }

  for (const resource of resources) {
    const s = score(normalize(resource.title), needle)
    if (s === null) continue
    results.push({
      kind: 'resource',
      id: resource.id,
      title: resource.title,
      subtitle: resource.url,
      score: s + 2,
    })
  }

  return results
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'es'))
    .slice(0, limit)
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
