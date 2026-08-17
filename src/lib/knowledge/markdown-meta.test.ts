import { describe, expect, it } from 'vitest'

import { extractNoteMeta } from './markdown-meta'

/**
 * The extractor is the single reading of "what does this note say about
 * itself", so these tests pin BEHAVIOUR at the boundaries where a hand-rolled
 * parser typically lies: malformed frontmatter, code blocks, and offsets.
 */

// ---------------------------------------------------------------- frontmatter

describe('frontmatter', () => {
  it('parses scalars, stripping optional quotes', () => {
    const meta = extractNoteMeta(
      'a.md',
      '---\nsubject: Redes de Datos\ntitle: "Apunte 1"\n---\nbody',
    )
    expect(meta.frontmatter).toEqual({ subject: 'Redes de Datos', title: 'Apunte 1' })
  })

  it('parses a block list', () => {
    const meta = extractNoteMeta('a.md', '---\ntags:\n  - Redes\n  - parcial\n---\n')
    expect(meta.frontmatter['tags']).toEqual(['Redes', 'parcial'])
  })

  it('parses an inline list', () => {
    const meta = extractNoteMeta('a.md', '---\ntags: [Redes, parcial]\n---\n')
    expect(meta.frontmatter['tags']).toEqual(['Redes', 'parcial'])
  })

  it('a block without a closing --- is content, not frontmatter', () => {
    const meta = extractNoteMeta('a.md', '---\ntitle: fake\n\n# Real Heading\n[[Link]]')
    expect(meta.frontmatter).toEqual({})
    // The would-be frontmatter region is BODY now: its structures must index.
    expect(meta.headings).toEqual([{ level: 1, text: 'Real Heading' }])
    expect(meta.links.map((l) => l.target)).toEqual(['Link'])
    expect(meta.title).toBe('Real Heading')
  })

  it('one unparseable line rejects the whole block as content', () => {
    const contents = '---\ntitle: fake\nnot yaml at all\n---\n# Body Title'
    const meta = extractNoteMeta('a.md', contents)
    expect(meta.frontmatter).toEqual({})
    // Half-applying `title: fake` would be worse than ignoring the block.
    expect(meta.title).toBe('Body Title')
  })

  it('only the very first line can open frontmatter', () => {
    const meta = extractNoteMeta('a.md', '\n---\ntitle: fake\n---\n')
    expect(meta.frontmatter).toEqual({})
    expect(meta.title).toBe('a')
  })

  it('a list item with no owning key is malformed, not silently dropped', () => {
    const meta = extractNoteMeta('a.md', '---\n  - orphan\n---\n')
    expect(meta.frontmatter).toEqual({})
  })
})

// ---------------------------------------------------------------------- title

describe('title precedence', () => {
  it('frontmatter title beats heading and filename', () => {
    const meta = extractNoteMeta('notes/tp4.md', '---\ntitle: TP 4 Redes\n---\n# Otro\n')
    expect(meta.title).toBe('TP 4 Redes')
  })

  it('first # heading beats filename when frontmatter has no title', () => {
    const meta = extractNoteMeta('notes/tp4.md', '## minor\n# Primer H1\n# Segundo H1\n')
    expect(meta.title).toBe('Primer H1')
  })

  it('falls back to the filename without extension', () => {
    const meta = extractNoteMeta('notes/Análisis Matemático.md', 'sin título acá')
    expect(meta.title).toBe('Análisis Matemático')
  })
})

// ---------------------------------------------------------------------- links

describe('links', () => {
  it('captures target, alias and the exact character offset', () => {
    const contents = 'intro\nver [[Redes]] y [[Análisis|el otro apunte]]\n'
    const meta = extractNoteMeta('a.md', contents)
    expect(meta.links).toEqual([
      { target: 'Redes', alias: null, offset: contents.indexOf('[[Redes]]') },
      {
        target: 'Análisis',
        alias: 'el otro apunte',
        offset: contents.indexOf('[[Análisis'),
      },
    ])
  })

  it('ignores links inside fenced code blocks', () => {
    const contents = 'antes [[Real]]\n```\n[[Fake]]\n```\ndespués [[También]]\n'
    const meta = extractNoteMeta('a.md', contents)
    expect(meta.links.map((l) => l.target)).toEqual(['Real', 'También'])
  })

  it('ignores links inside inline code but not their neighbours', () => {
    const contents = 'usar `[[Fake]]` como en [[Real]]\n'
    const meta = extractNoteMeta('a.md', contents)
    expect(meta.links).toEqual([
      { target: 'Real', alias: null, offset: contents.indexOf('[[Real') },
    ])
  })
})

// ------------------------------------------------------------------- headings

describe('headings', () => {
  it('captures levels 1 through 6 and nothing beyond', () => {
    const contents = '# a\n###### f\n####### no\n#nospace\n'
    const meta = extractNoteMeta('a.md', contents)
    expect(meta.headings).toEqual([
      { level: 1, text: 'a' },
      { level: 6, text: 'f' },
    ])
  })

  it('ignores headings inside fenced code', () => {
    const meta = extractNoteMeta('a.md', '```\n# comentario de shell\n```\n## real\n')
    expect(meta.headings).toEqual([{ level: 2, text: 'real' }])
  })
})

// ----------------------------------------------------------------------- tags

describe('tags', () => {
  it('normalizes a scalar tag to lowercase without #', () => {
    const meta = extractNoteMeta('a.md', '---\ntags: "#Facultad"\n---\n')
    expect(meta.tags).toEqual(['facultad'])
  })

  it('normalizes list tags', () => {
    const meta = extractNoteMeta('a.md', '---\ntags:\n  - "#Redes"\n  - PARCIAL\n---\n')
    expect(meta.tags).toEqual(['redes', 'parcial'])
  })

  it('has no tags when frontmatter declares none', () => {
    expect(extractNoteMeta('a.md', '# x\n#hashtag-in-body\n').tags).toEqual([])
  })
})
