/**
 * Pure extraction of the metadata `VaultIndex` needs from one markdown note.
 *
 * No I/O, no React, no YAML dependency. The frontmatter grammar is deliberately
 * tiny — scalars, block lists, inline lists — because a full YAML parser would
 * make "what does Campus index?" depend on a spec nobody in this codebase has
 * read. Anything the grammar does not recognise is treated as ordinary note
 * content: a student's half-typed frontmatter must degrade to text, never to a
 * crash or to silently-dropped links.
 */

export interface NoteLink {
  readonly target: string
  readonly alias: string | null
  /** Offset of the opening `[[` within the full note contents, so callers can jump to it. */
  readonly offset: number
}

export interface NoteHeading {
  readonly level: number
  readonly text: string
}

export interface NoteMeta {
  readonly path: string
  readonly title: string
  readonly frontmatter: Record<string, string | string[]>
  readonly tags: string[]
  readonly links: NoteLink[]
  readonly headings: NoteHeading[]
}

/**
 * Shared between title fallback here and basename resolution in the index.
 * One definition, because the moment the two drift apart a note stops being
 * findable under the exact name the UI displays for it.
 */
export function noteBasename(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  // `dot > 0` keeps dotfiles like `.campus` whole instead of truncating to ''.
  return dot > 0 ? base.slice(0, dot) : base
}

interface Line {
  readonly text: string
  /** Offset of the line's first character within the full contents. */
  readonly offset: number
}

const splitLines = (contents: string): Line[] => {
  const lines: Line[] = []
  let offset = 0
  for (const text of contents.split('\n')) {
    lines.push({ text, offset })
    offset += text.length + 1
  }
  return lines
}

/** `"quoted"` and `'quoted'` scalars lose their quotes; anything else is verbatim. */
const unquote = (value: string): string => {
  const q = value[0]
  if (value.length >= 2 && (q === '"' || q === "'") && value.endsWith(q)) {
    return value.slice(1, -1)
  }
  return value
}

interface ParsedFrontmatter {
  readonly frontmatter: Record<string, string | string[]>
  /** Index of the first body line (the one after the closing `---`). */
  readonly bodyLine: number
}

/**
 * Returns `null` for "there is no frontmatter here", which the caller maps to
 * "everything is body". That single decision is what makes malformed blocks
 * safe: one unrecognised line rejects the WHOLE block, so we never index half
 * a frontmatter and pretend the rest of it was prose.
 */
const parseFrontmatter = (lines: Line[]): ParsedFrontmatter | null => {
  if (lines[0]?.text !== '---') return null
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.text === '---') {
      close = i
      break
    }
  }
  if (close === -1) return null

  const frontmatter: Record<string, string | string[]> = {}
  let pendingList: string | null = null
  for (let i = 1; i < close; i++) {
    const text = lines[i]!.text
    if (text.trim() === '') {
      pendingList = null
      continue
    }
    // Block-list items must be indented under an opened `key:` line; a stray
    // dash with no owner is not a list, it is malformed frontmatter.
    const item = /^\s+-\s+(.+)$/.exec(text)
    if (item !== null && pendingList !== null) {
      ;(frontmatter[pendingList] as string[]).push(unquote(item[1]!.trim()))
      continue
    }
    const entry = /^([^\s:][^:]*):(.*)$/.exec(text)
    if (entry === null) return null
    const key = entry[1]!.trim()
    const rest = entry[2]!.trim()
    if (rest === '') {
      frontmatter[key] = []
      pendingList = key
      continue
    }
    pendingList = null
    if (rest.startsWith('[') && rest.endsWith(']')) {
      frontmatter[key] = rest
        .slice(1, -1)
        .split(',')
        .map((part) => unquote(part.trim()))
        .filter((part) => part !== '')
    } else {
      frontmatter[key] = unquote(rest)
    }
  }
  return { frontmatter, bodyLine: close + 1 }
}

const HEADING = /^(#{1,6}) +(.+)$/
const WIKI_LINK = /\[\[([^[\]\n]+)\]\]/g
const INLINE_CODE = /`[^`\n]*`/g

export function extractNoteMeta(path: string, contents: string): NoteMeta {
  const lines = splitLines(contents)
  const parsed = parseFrontmatter(lines)
  const frontmatter = parsed?.frontmatter ?? {}
  const bodyLine = parsed?.bodyLine ?? 0

  const links: NoteLink[] = []
  const headings: NoteHeading[] = []
  let inFence = false
  for (let i = bodyLine; i < lines.length; i++) {
    const { text, offset } = lines[i]!
    if (text.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const heading = HEADING.exec(text)
    if (heading !== null) {
      headings.push({ level: heading[1]!.length, text: heading[2]!.trim() })
    }

    // Inline code is masked by RANGE, not stripped, so that offsets of links
    // sitting after a code span still point at the real characters.
    const codeRanges: Array<readonly [number, number]> = []
    for (const code of text.matchAll(INLINE_CODE)) {
      codeRanges.push([code.index, code.index + code[0].length])
    }
    for (const match of text.matchAll(WIKI_LINK)) {
      const at = match.index
      if (codeRanges.some(([start, end]) => at >= start && at < end)) continue
      const inner = match[1]!
      const pipe = inner.indexOf('|')
      const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim()
      if (target === '') continue
      const alias = pipe === -1 ? null : inner.slice(pipe + 1).trim()
      links.push({ target, alias, offset: offset + at })
    }
  }

  // Precedence: an explicit frontmatter title is the author's word; the first
  // H1 is the document's word; the filename is the fallback nobody chose.
  const declared = frontmatter['title']
  const firstH1 = headings.find((h) => h.level === 1)
  const title =
    typeof declared === 'string' && declared !== ''
      ? declared
      : (firstH1?.text ?? noteBasename(path))

  const rawTags = frontmatter['tags']
  const tags = (typeof rawTags === 'string' ? [rawTags] : (rawTags ?? []))
    // Lowercase without '#': tags are identity keys for search/filtering, and
    // `#Uni` vs `uni` must never count as two different tags.
    .map((tag) => tag.replace(/^#/, '').toLowerCase())
    .filter((tag) => tag !== '')

  return { path, title, frontmatter, tags, links, headings }
}
