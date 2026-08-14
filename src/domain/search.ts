import type { AcademicItem, Resource, SubjectView } from './types'

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

export type SearchResultKind = 'subject' | 'item' | 'resource'

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

const SUBJECT_LABEL: Record<string, string> = {
  passed: 'Aprobada',
  equivalent: 'Equivalencia',
  in_progress: 'Cursando',
  regularized: 'Regularizada',
  available: 'Disponible',
  blocked: 'Bloqueada',
  pending: 'Pendiente',
  failed: 'Desaprobada',
}

export function search(
  { subjects, items, resources }: SearchInput,
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
      subtitle: `${subject.yearLevel}° año · ${SUBJECT_LABEL[subject.status] ?? subject.status}`,
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
