/**
 * Derived, rebuildable index over note contents that were handed in — the
 * index never reads a file, so it can serve LOCAL and REMOTE vaults alike and
 * can always be rebuilt by replaying `upsert` over the vault listing.
 *
 * Everything is answered from internal maps (`byPath`, folded title/basename
 * multimaps, and an inverted link-text → sources map) because the operations
 * the editor calls per keystroke — `resolve`, `backlinks`, `quickMatch` —
 * must stay proportional to their real answer, not to vault size. A 5000-note
 * vault where `backlinks` scans every note is an editor that stutters.
 */

import { extractNoteMeta, noteBasename } from './markdown-meta'
import type { NoteMeta } from './markdown-meta'

export type LinkResolution =
  | { readonly status: 'resolved'; readonly path: string }
  | { readonly status: 'ambiguous'; readonly candidates: string[] }
  | { readonly status: 'missing' }

export interface Backlink {
  readonly sourcePath: string
  readonly sourceTitle: string
  readonly snippet: string
}

export interface SearchResult {
  readonly path: string
  readonly title: string
  readonly snippet: string
  readonly score: number
}

export interface QuickMatchResult {
  readonly path: string
  readonly title: string
}

export interface VaultStats {
  readonly notes: number
  readonly links: number
  readonly unresolved: number
}

const SEARCH_LIMIT = 50
const QUICK_MATCH_LIMIT = 20
const SNIPPET_MAX = 120

/**
 * Case- and diacritic-insensitive folding: "Análisis" and "analisis" are the
 * same note to a student typing on a keyboard without dead keys.
 */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const addTo = (map: Map<string, Set<string>>, key: string, value: string): void => {
  const existing = map.get(key)
  if (existing) existing.add(value)
  else map.set(key, new Set([value]))
}

const removeFrom = (map: Map<string, Set<string>>, key: string, value: string): void => {
  const existing = map.get(key)
  if (!existing) return
  existing.delete(value)
  if (existing.size === 0) map.delete(key)
}

/** The line containing `offset`, trimmed, windowed to ≤120 chars AROUND the link. */
const snippetAt = (contents: string, offset: number): string => {
  const lineStart = contents.lastIndexOf('\n', offset - 1) + 1
  const newline = contents.indexOf('\n', offset)
  const lineEnd = newline === -1 ? contents.length : newline
  const raw = contents.slice(lineStart, lineEnd)
  const line = raw.trim()
  if (line.length <= SNIPPET_MAX) return line
  // Centre the window on the link: a snippet that trims the link itself out
  // would show the student a backlink they cannot see.
  const leading = raw.length - raw.trimStart().length
  const column = Math.max(0, offset - lineStart - leading)
  const start = Math.min(Math.max(0, column - SNIPPET_MAX / 2), line.length - SNIPPET_MAX)
  return line.slice(start, start + SNIPPET_MAX)
}

interface IndexedNote {
  readonly meta: NoteMeta
  readonly contents: string
  readonly foldedPath: string
  readonly foldedTitle: string
  readonly foldedBasename: string
  /** Folded once at upsert so search does not re-normalize 5000 bodies per keystroke. */
  readonly foldedBody: string
}

export class VaultIndex {
  private readonly byPath = new Map<string, IndexedNote>()
  /** Folded title → paths. A Set because duplicate titles are legal and must surface as ambiguity. */
  private readonly byTitle = new Map<string, Set<string>>()
  private readonly byBasename = new Map<string, Set<string>>()
  /**
   * Folded outgoing link text → source paths. This is what keeps `backlinks`
   * O(sources): the target note's own names are the only keys a link could
   * have used to reach it, so we look those up instead of scanning the vault.
   */
  private readonly sourcesByLinkText = new Map<string, Set<string>>()

  upsert(path: string, contents: string): void {
    // Replace, don't merge: stale title/link registrations from the previous
    // version of this note would resurrect deleted links.
    if (this.byPath.has(path)) this.remove(path)
    const meta = extractNoteMeta(path, contents)
    const note: IndexedNote = {
      meta,
      contents,
      foldedPath: fold(path),
      foldedTitle: fold(meta.title),
      foldedBasename: fold(noteBasename(path)),
      foldedBody: fold(contents),
    }
    this.byPath.set(path, note)
    addTo(this.byTitle, note.foldedTitle, path)
    addTo(this.byBasename, note.foldedBasename, path)
    for (const link of meta.links) addTo(this.sourcesByLinkText, fold(link.target), path)
  }

  remove(path: string): void {
    const note = this.byPath.get(path)
    if (!note) return
    this.byPath.delete(path)
    removeFrom(this.byTitle, note.foldedTitle, path)
    removeFrom(this.byBasename, note.foldedBasename, path)
    for (const link of note.meta.links) {
      removeFrom(this.sourcesByLinkText, fold(link.target), path)
    }
  }

  /**
   * Index state only — file contents are never rewritten here, because the
   * index is derived and a derived structure must not mutate its source.
   * Re-extracting under the new path is what "rewrites incoming resolution":
   * links by stable names (frontmatter title, headings) follow the note to
   * its new path, while links by the old filename correctly stop resolving.
   */
  rename(from: string, to: string): void {
    const note = this.byPath.get(from)
    if (!note) return
    this.remove(from)
    this.upsert(to, note.contents)
  }

  notes(): NoteMeta[] {
    return [...this.byPath.values()]
      .map((note) => note.meta)
      .sort((a, b) => compare(a.path, b.path))
  }

  get(path: string): NoteMeta | null {
    return this.byPath.get(path)?.meta ?? null
  }

  resolve(linkText: string): LinkResolution {
    const text = linkText.trim()
    // A path hit is exact and unambiguous by construction, so it wins outright.
    if (this.byPath.has(text)) return { status: 'resolved', path: text }
    const withExtension = `${text}.md`
    if (this.byPath.has(withExtension)) return { status: 'resolved', path: withExtension }

    const folded = fold(text)
    // A multi-match at the title tier is AMBIGUOUS, not "try basenames next":
    // falling through would silently pick a different note than the ones the
    // student is being asked to disambiguate between.
    const titleMatches = this.byTitle.get(folded)
    if (titleMatches !== undefined && titleMatches.size > 0) return pickFrom(titleMatches)
    const basenameMatches = this.byBasename.get(folded)
    if (basenameMatches !== undefined && basenameMatches.size > 0) {
      return pickFrom(basenameMatches)
    }
    return { status: 'missing' }
  }

  backlinks(path: string): Backlink[] {
    const target = this.byPath.get(path)
    if (!target) return []
    // Only these names can reach this note, so only their sources are visited.
    const reachableAs = new Set([
      target.foldedPath,
      fold(path.replace(/\.md$/, '')),
      target.foldedTitle,
      target.foldedBasename,
    ])
    const candidates = new Set<string>()
    for (const key of reachableAs) {
      for (const source of this.sourcesByLinkText.get(key) ?? []) candidates.add(source)
    }

    const backlinks: Backlink[] = []
    for (const sourcePath of [...candidates].sort(compare)) {
      const source = this.byPath.get(sourcePath)!
      for (const link of source.meta.links) {
        // Re-resolving confirms the candidate: an ambiguous link points at no
        // single note, so it is a backlink of NONE of its candidates.
        const resolution = this.resolve(link.target)
        if (resolution.status !== 'resolved' || resolution.path !== path) continue
        backlinks.push({
          sourcePath,
          sourceTitle: source.meta.title,
          snippet: snippetAt(source.contents, link.offset),
        })
      }
    }
    return backlinks
  }

  search(query: string): SearchResult[] {
    const folded = fold(query.trim())
    if (folded === '') return []
    const results: SearchResult[] = []
    for (const [path, note] of this.byPath) {
      // One tier per note — the BEST way it matches — so ranking stays a
      // single comparable number instead of an additive soup.
      let score: number
      if (note.foldedTitle.startsWith(folded)) score = 5
      else if (note.foldedTitle.includes(folded)) score = 4
      else if (note.meta.tags.some((tag) => fold(tag).includes(folded))) score = 3
      else if (note.foldedBasename.includes(folded)) score = 2
      else if (note.foldedBody.includes(folded)) score = 1
      else continue
      const snippet = score === 1 ? bodySnippet(note.contents, folded) : note.meta.title
      results.push({ path, title: note.meta.title, snippet, score })
    }
    return results
      .sort((a, b) => b.score - a.score || compare(a.path, b.path))
      .slice(0, SEARCH_LIMIT)
  }

  quickMatch(query: string, recentPaths: string[]): QuickMatchResult[] {
    const folded = fold(query.trim())
    if (folded === '') {
      // No query means "where was I?": recents in the order given, then the
      // rest alphabetically so the list is stable, not insertion-ordered.
      const picked: QuickMatchResult[] = []
      const seen = new Set<string>()
      for (const path of recentPaths) {
        const note = this.byPath.get(path)
        if (!note || seen.has(path)) continue
        seen.add(path)
        picked.push({ path, title: note.meta.title })
        if (picked.length === QUICK_MATCH_LIMIT) return picked
      }
      const rest = [...this.byPath.entries()]
        .filter(([path]) => !seen.has(path))
        .sort(([pa, a], [pb, b]) => compare(a.foldedTitle, b.foldedTitle) || compare(pa, pb))
      for (const [path, note] of rest) {
        picked.push({ path, title: note.meta.title })
        if (picked.length === QUICK_MATCH_LIMIT) break
      }
      return picked
    }

    const recent = new Set(recentPaths)
    const scored: Array<QuickMatchResult & { score: number }> = []
    for (const [path, note] of this.byPath) {
      let score: number
      if (note.foldedTitle.startsWith(folded)) score = 100
      else if (note.foldedTitle.includes(folded)) score = 80
      else if (isSubsequence(folded, note.foldedTitle)) score = 60
      else if (note.foldedPath.includes(folded)) score = 40
      else if (isSubsequence(folded, note.foldedPath)) score = 20
      else continue
      // +10 breaks ties WITHIN a tier without letting a recent fuzzy match
      // outrank a non-recent exact one — recency is a nudge, not a veto.
      if (recent.has(path)) score += 10
      scored.push({ path, title: note.meta.title, score })
    }
    return scored
      .sort((a, b) => b.score - a.score || compare(a.title, b.title) || compare(a.path, b.path))
      .slice(0, QUICK_MATCH_LIMIT)
      .map(({ path, title }) => ({ path, title }))
  }

  stats(): VaultStats {
    let links = 0
    let unresolved = 0
    for (const note of this.byPath.values()) {
      for (const link of note.meta.links) {
        links += 1
        // Ambiguous counts as unresolved: the link does not land on a note.
        if (this.resolve(link.target).status !== 'resolved') unresolved += 1
      }
    }
    return { notes: this.byPath.size, links, unresolved }
  }
}

const pickFrom = (paths: Set<string>): LinkResolution => {
  if (paths.size === 1) {
    return { status: 'resolved', path: paths.values().next().value! }
  }
  // Sorted candidates: "ambiguous" must render the same list every time, or
  // the disambiguation UI reshuffles under the student's cursor.
  return { status: 'ambiguous', candidates: [...paths].sort(compare) }
}

const isSubsequence = (needle: string, haystack: string): boolean => {
  let matched = 0
  for (let i = 0; i < haystack.length && matched < needle.length; i++) {
    if (haystack[i] === needle[matched]) matched += 1
  }
  return matched === needle.length
}

/** Folding can shift offsets, so the body snippet is found by re-folding per line. */
const bodySnippet = (contents: string, foldedQuery: string): string => {
  for (const raw of contents.split('\n')) {
    const line = raw.trim()
    if (line !== '' && fold(line).includes(foldedQuery)) {
      return line.length <= SNIPPET_MAX ? line : line.slice(0, SNIPPET_MAX)
    }
  }
  return ''
}
