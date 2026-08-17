import { describe, expect, it } from 'vitest'

import { VaultIndex } from './vault-index'

/**
 * Behaviour of the index as the editor sees it: what a link resolves to, who
 * points here, what the switcher offers. Internal maps are never inspected —
 * the 1000-note test instead pins the CONTRACT that makes them necessary.
 */

// -------------------------------------------------------------------- resolve

describe('resolve', () => {
  it('matches an exact vault-relative path, with or without .md', () => {
    const index = new VaultIndex()
    index.upsert('notes/tp4.md', '# TP 4\n')
    expect(index.resolve('notes/tp4.md')).toEqual({ status: 'resolved', path: 'notes/tp4.md' })
    expect(index.resolve('notes/tp4')).toEqual({ status: 'resolved', path: 'notes/tp4.md' })
  })

  it('matches a unique title ignoring case and diacritics', () => {
    const index = new VaultIndex()
    index.upsert('mat/parcial.md', '---\ntitle: Análisis Matemático I\n---\ncontenido')
    expect(index.resolve('analisis matematico i')).toEqual({
      status: 'resolved',
      path: 'mat/parcial.md',
    })
  })

  it('falls back to a unique basename when no title matches', () => {
    const index = new VaultIndex()
    index.upsert('deep/Redes.md', '---\ntitle: Apunte de la cátedra\n---\n')
    expect(index.resolve('redes')).toEqual({ status: 'resolved', path: 'deep/Redes.md' })
  })

  it('prefers a title match over another note basename', () => {
    const index = new VaultIndex()
    index.upsert('a.md', '---\ntitle: Química\n---\n')
    index.upsert('quimica.md', '---\ntitle: Otro tema\n---\n')
    expect(index.resolve('química')).toEqual({ status: 'resolved', path: 'a.md' })
  })

  it('duplicate titles are ambiguous with candidates sorted, never a random pick', () => {
    const index = new VaultIndex()
    // Inserted in reverse of the expected output to catch insertion-order leaks.
    index.upsert('b/parcial-2.md', '---\ntitle: Parcial\n---\n')
    index.upsert('a/parcial-1.md', '---\ntitle: Parcial\n---\n')
    expect(index.resolve('parcial')).toEqual({
      status: 'ambiguous',
      candidates: ['a/parcial-1.md', 'b/parcial-2.md'],
    })
  })

  it('an ambiguous title tier never falls through to basenames', () => {
    const index = new VaultIndex()
    index.upsert('x/grafos-a.md', '---\ntitle: Grafos\n---\n')
    index.upsert('y/grafos-b.md', '---\ntitle: Grafos\n---\n')
    index.upsert('z/Grafos.md', '---\ntitle: Apunte viejo\n---\n')
    // Falling through would silently resolve to z/Grafos.md — a third note the
    // student was never asked about.
    expect(index.resolve('grafos')).toEqual({
      status: 'ambiguous',
      candidates: ['x/grafos-a.md', 'y/grafos-b.md'],
    })
  })

  it('reports missing when nothing matches', () => {
    const index = new VaultIndex()
    index.upsert('a.md', 'hola')
    expect(index.resolve('inexistente')).toEqual({ status: 'missing' })
  })
})

// ------------------------------------------------------------------ backlinks

describe('backlinks', () => {
  it('returns source path, source title and the trimmed line as snippet', () => {
    const index = new VaultIndex()
    index.upsert('target.md', '---\ntitle: Objetivo\n---\n')
    index.upsert('src.md', '# Fuente\n\n  ver [[Objetivo]] antes del parcial  \n')
    expect(index.backlinks('target.md')).toEqual([
      {
        sourcePath: 'src.md',
        sourceTitle: 'Fuente',
        snippet: 'ver [[Objetivo]] antes del parcial',
      },
    ])
  })

  it('windows a long line to 120 chars without losing the link', () => {
    const index = new VaultIndex()
    index.upsert('target.md', '# Objetivo\n')
    const line = `${'x'.repeat(150)} [[Objetivo]] ${'y'.repeat(150)}`
    index.upsert('src.md', `${line}\n`)
    const [backlink] = index.backlinks('target.md')
    expect(backlink!.snippet.length).toBe(120)
    expect(backlink!.snippet).toContain('[[Objetivo]]')
  })

  it('an ambiguous link is a backlink of NO note', () => {
    const index = new VaultIndex()
    index.upsert('d1.md', '---\ntitle: Dup\n---\n')
    index.upsert('d2.md', '---\ntitle: Dup\n---\n')
    index.upsert('src.md', 'ver [[Dup]]\n')
    // Crediting both candidates would fabricate a reference the author never
    // made to either.
    expect(index.backlinks('d1.md')).toEqual([])
    expect(index.backlinks('d2.md')).toEqual([])
  })

  it('a 1000-note vault answers from real sources only', () => {
    const index = new VaultIndex()
    index.upsert('hub.md', '# Hub\n')
    const linkers = new Set([3, 400, 999])
    for (let i = 0; i < 1000; i++) {
      const extra = linkers.has(i) ? ' y [[Hub]]' : ''
      index.upsert(
        `bulk/note-${i}.md`,
        `# Bulk ${i}\n\nver [[note-${(i + 1) % 1000}]]${extra}\n`,
      )
    }
    // Functional, not timed: exactly the three linking notes appear, nothing
    // from the other 997 leaks in through a full-vault scan gone wrong.
    expect(index.backlinks('hub.md').map((b) => b.sourcePath)).toEqual([
      'bulk/note-3.md',
      'bulk/note-400.md',
      'bulk/note-999.md',
    ])
    expect(index.stats()).toEqual({ notes: 1001, links: 1003, unresolved: 0 })
  })
})

// --------------------------------------------------------------------- rename

describe('rename', () => {
  it('moves resolution and backlinks to the new path for stable names', () => {
    const index = new VaultIndex()
    index.upsert('old/redes.md', '---\ntitle: Redes\ntags: [parcial]\n---\ncontenido')
    index.upsert('src.md', 'repasar [[Redes]]\n')

    index.rename('old/redes.md', 'new/networks.md')

    // The frontmatter title travels with the contents, so incoming links keep
    // resolving — now to the new path — without rewriting any file.
    expect(index.resolve('Redes')).toEqual({ status: 'resolved', path: 'new/networks.md' })
    expect(index.backlinks('new/networks.md').map((b) => b.sourcePath)).toEqual(['src.md'])
    expect(index.get('old/redes.md')).toBeNull()
    expect(index.backlinks('old/redes.md')).toEqual([])
    // Meta preserved: nothing about the note itself changed but its path.
    const meta = index.get('new/networks.md')
    expect(meta?.title).toBe('Redes')
    expect(meta?.tags).toEqual(['parcial'])
  })

  it('a filename-derived title follows the file, so old-name links stop resolving', () => {
    const index = new VaultIndex()
    index.upsert('Viejo.md', 'sin heading ni frontmatter')
    index.upsert('src.md', 'ver [[Viejo]]\n')

    index.rename('Viejo.md', 'Nuevo.md')

    expect(index.resolve('Viejo')).toEqual({ status: 'missing' })
    expect(index.resolve('Nuevo')).toEqual({ status: 'resolved', path: 'Nuevo.md' })
    // The [[Viejo]] link now points at nothing, so it backs nothing.
    expect(index.backlinks('Nuevo.md')).toEqual([])
  })
})

// ----------------------------------------------------------- remove and upsert

describe('remove', () => {
  it('clears the note from resolution, listing and stats', () => {
    const index = new VaultIndex()
    index.upsert('a.md', '# A\nver [[B]]\n')
    index.upsert('b.md', '# B\n')

    index.remove('b.md')

    expect(index.get('b.md')).toBeNull()
    expect(index.resolve('B')).toEqual({ status: 'missing' })
    expect(index.notes().map((n) => n.path)).toEqual(['a.md'])
    expect(index.stats()).toEqual({ notes: 1, links: 1, unresolved: 1 })
  })

  it('removing a source removes its backlinks', () => {
    const index = new VaultIndex()
    index.upsert('a.md', 'ver [[B]]\n')
    index.upsert('b.md', '# B\n')
    index.remove('a.md')
    expect(index.backlinks('b.md')).toEqual([])
  })
})

describe('upsert', () => {
  it('replaces the previous version instead of merging with it', () => {
    const index = new VaultIndex()
    index.upsert('a.md', '---\ntitle: Antes\n---\nver [[Algo]]\n')
    index.upsert('algo.md', '# Algo\n')

    index.upsert('a.md', '---\ntitle: Después\n---\nsin links\n')

    expect(index.notes()).toHaveLength(2)
    expect(index.resolve('Antes')).toEqual({ status: 'missing' })
    expect(index.resolve('Después')).toEqual({ status: 'resolved', path: 'a.md' })
    // The deleted [[Algo]] link must not survive as a stale backlink.
    expect(index.backlinks('algo.md')).toEqual([])
  })
})

// --------------------------------------------------------------------- search

describe('search', () => {
  const ranked = (): VaultIndex => {
    const index = new VaultIndex()
    index.upsert('n1.md', '---\ntitle: Redes de Datos\n---\nnada')
    index.upsert('n2.md', '---\ntitle: Apuntes de Redes\n---\nnada')
    index.upsert('n3.md', '---\ntitle: TP Final\ntags: [redes]\n---\nnada')
    index.upsert('materias/redes-2.md', '---\ntitle: Segundo Parcial\n---\nnada')
    index.upsert('n5.md', '---\ntitle: Resumen\n---\nlas redes conmutadas\n')
    return index
  }

  it('ranks title-start > title-includes > tag > filename > body, explicitly', () => {
    const results = ranked().search('redes')
    expect(results.map((r) => r.path)).toEqual([
      'n1.md',
      'n2.md',
      'n3.md',
      'materias/redes-2.md',
      'n5.md',
    ])
    // Strictly descending scores: five distinct tiers, not accidental order.
    const scores = results.map((r) => r.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    expect(new Set(scores).size).toBe(5)
  })

  it('a title-start match always beats a body match', () => {
    const results = ranked().search('redes')
    const title = results.find((r) => r.path === 'n1.md')!
    const body = results.find((r) => r.path === 'n5.md')!
    expect(title.score).toBeGreaterThan(body.score)
    expect(body.snippet).toBe('las redes conmutadas')
  })

  it('matches across diacritics in both query and content', () => {
    const index = new VaultIndex()
    index.upsert('a.md', '---\ntitle: Análisis\n---\n')
    index.upsert('b.md', '---\ntitle: Otro\n---\nver el análisis completo\n')
    expect(index.search('analisis').map((r) => r.path)).toEqual(['a.md', 'b.md'])
  })

  it('returns at most 50 results and none for an empty query', () => {
    const index = new VaultIndex()
    for (let i = 0; i < 60; i++) index.upsert(`n${i}.md`, `# Nota ${i}\ntema redes\n`)
    expect(index.search('redes')).toHaveLength(50)
    expect(index.search('   ')).toEqual([])
  })
})

// ----------------------------------------------------------------- quickMatch

describe('quickMatch', () => {
  it('empty query lists existing recents first, then the rest by title', () => {
    const index = new VaultIndex()
    index.upsert('c.md', '# Gamma\n')
    index.upsert('a.md', '# Alpha\n')
    index.upsert('b.md', '# Beta\n')
    const matches = index.quickMatch('', ['b.md', 'ghost.md'])
    // 'ghost.md' is not in the vault: a stale recents list must not invent notes.
    expect(matches.map((m) => m.path)).toEqual(['b.md', 'a.md', 'c.md'])
  })

  it('matches a subsequence of the title', () => {
    const index = new VaultIndex()
    index.upsert('r.md', '# Redes de Datos\n')
    index.upsert('q.md', '# Química\n')
    expect(index.quickMatch('rdd', []).map((m) => m.path)).toEqual(['r.md'])
    expect(index.quickMatch('zzz', [])).toEqual([])
  })

  it('a recent path outranks an equal match, but not a better one', () => {
    const index = new VaultIndex()
    index.upsert('g.md', '# Redes Globales\n')
    index.upsert('l.md', '# Redes Locales\n')
    // Same tier, no recents: alphabetical by title.
    expect(index.quickMatch('redes', []).map((m) => m.path)).toEqual(['g.md', 'l.md'])
    // Same tier, 'l.md' recent: the boost flips the tie.
    expect(index.quickMatch('redes', ['l.md']).map((m) => m.path)).toEqual(['l.md', 'g.md'])
    // Different tier: recency must not promote a fuzzy match over an exact one.
    index.upsert('f.md', '# Recetas de sopa\n') // 'redes' is only a subsequence here
    expect(index.quickMatch('redes', ['f.md']).map((m) => m.path)).toEqual([
      'g.md',
      'l.md',
      'f.md',
    ])
  })

  it('returns at most 20 matches', () => {
    const index = new VaultIndex()
    for (let i = 0; i < 25; i++) index.upsert(`n${i}.md`, `# Redes ${i}\n`)
    expect(index.quickMatch('redes', [])).toHaveLength(20)
    expect(index.quickMatch('', [])).toHaveLength(20)
  })
})

// ---------------------------------------------------------------------- stats

describe('stats', () => {
  it('counts notes, link occurrences, and unresolved (missing plus ambiguous)', () => {
    const index = new VaultIndex()
    index.upsert('d1.md', '---\ntitle: Dup\n---\n')
    index.upsert('d2.md', '---\ntitle: Dup\n---\n')
    index.upsert('b.md', '# B\n')
    index.upsert('a.md', 'ver [[B]] y [[Nada]] y [[Dup]]\n')
    // Ambiguous is unresolved: the link lands on no single note.
    expect(index.stats()).toEqual({ notes: 4, links: 3, unresolved: 2 })
  })
})
