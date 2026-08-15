import { describe, expect, it } from 'vitest'

import { isSafeSegment, validateVaultPath } from './path-resolver'

/**
 * VAULT-001 — path resolution is the security boundary.
 *
 * These are written as an attacker, not as a user. Every case here is a way to
 * name a file outside the vault while looking like a file inside it. The list in
 * the spec is the floor, not the ceiling.
 *
 * This half is PURE: it judges the requested path before any I/O happens. The
 * `realpath` half lives in the repository, because a string cannot know what a
 * symlink points at.
 */

const reject = (p: string) => {
  const r = validateVaultPath(p)
  expect(r.ok, `"${p}" was accepted and must not be`).toBe(false)
  return r.ok ? '' : r.reason
}

const accept = (p: string) => {
  const r = validateVaultPath(p)
  expect(r.ok, `"${p}" was rejected: ${r.ok ? '' : r.reason}`).toBe(true)
  return r.ok ? r.segments : []
}

describe('validateVaultPath — traversal', () => {
  it('rejects plain traversal', () => {
    expect(reject('../../../etc/passwd')).toMatch(/traversal/i)
  })

  it('rejects traversal that hides after a valid segment', () => {
    // The dangerous one: the prefix is a real vault folder, so a naive
    // startsWith(root) check on the unresolved string passes.
    expect(reject('Materias/../../etc/passwd')).toMatch(/traversal/i)
  })

  it('rejects a lone .. segment', () => {
    expect(reject('..')).toMatch(/traversal/i)
  })

  it('accepts a filename that merely contains dots', () => {
    // ..foo is not traversal. Rejecting it would be a bug that teaches students
    // their own filenames are illegal.
    expect(accept('Materias/..foo.md')).toEqual(['Materias', '..foo.md'])
    expect(accept('Daily/2026-08-14.md')).toEqual(['Daily', '2026-08-14.md'])
  })
})

describe('validateVaultPath — absolute escape', () => {
  it('rejects a POSIX absolute path', () => {
    expect(reject('/etc/passwd')).toMatch(/absolute/i)
  })

  it('rejects a Windows drive-absolute path', () => {
    // A vault made on Linux must open on Windows, so Windows-shaped attacks are
    // in scope even when Campus is running on Linux.
    expect(reject('C:\\Windows\\System32\\drivers\\etc\\hosts')).toMatch(/absolute/i)
  })

  it('rejects a UNC path', () => {
    expect(reject('\\\\server\\share\\file.md')).toMatch(/absolute/i)
  })

  it('rejects a backslash-separated traversal', () => {
    // Backslash is a separator on Windows. Treating it as an ordinary character
    // means `..\..\etc` reaches the filesystem as one "filename" that Windows
    // then splits — the classic separator-confusion bypass.
    expect(reject('Materias\\..\\..\\etc\\passwd')).toMatch(/traversal/i)
  })
})

describe('validateVaultPath — malformed filenames', () => {
  it('rejects a NUL byte', () => {
    expect(reject('Materias/nota\u0000.md')).toMatch(/control character/i)
  })

  it('rejects other control characters', () => {
    expect(reject('Materias/no\u0007ta.md')).toMatch(/control character/i)
    expect(reject('Materias/no\u001fta.md')).toMatch(/control character/i)
  })

  it('rejects Windows-forbidden characters everywhere, not only on Windows', () => {
    for (const ch of ['<', '>', ':', '"', '|', '?', '*']) {
      expect(reject(`Materias/no${ch}ta.md`)).toMatch(/forbidden character/i)
    }
  })

  it('rejects reserved device names, with or without an extension', () => {
    for (const name of ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9']) {
      expect(reject(`Materias/${name}`)).toMatch(/reserved/i)
      expect(reject(`Materias/${name}.md`)).toMatch(/reserved/i)
      expect(reject(`Materias/${name.toLowerCase()}.md`)).toMatch(/reserved/i)
    }
  })

  it('accepts a name that merely starts like a reserved one', () => {
    // CONtabilidad is a legitimate subject folder. Over-matching here would
    // reject real coursework.
    expect(accept('Materias/CONtabilidad')).toEqual(['Materias', 'CONtabilidad'])
    expect(accept('Materias/COM10.md')).toEqual(['Materias', 'COM10.md'])
  })

  it('rejects trailing dots and spaces', () => {
    // Windows silently strips these, so "nota .md" and "nota.md" become the same
    // file — two vault entries collapsing into one, with data loss.
    expect(reject('Materias/nota.')).toMatch(/trailing/i)
    expect(reject('Materias/nota ')).toMatch(/trailing/i)
    expect(reject('Materias /nota.md')).toMatch(/trailing/i)
  })

  it('rejects an empty segment', () => {
    expect(reject('Materias//nota.md')).toMatch(/empty segment/i)
    expect(reject('')).toMatch(/empty/i)
  })

  it('rejects a path over the Windows length limit', () => {
    expect(reject(`Materias/${'a'.repeat(300)}.md`)).toMatch(/too long/i)
  })

  it('accepts accented and non-ASCII names', () => {
    // "Análisis Matemático II" is a real subject. A resolver that only allows
    // ASCII is unusable for the students this is built for.
    expect(accept('Materias/Análisis Matemático II/clase 01.md')).toEqual([
      'Materias',
      'Análisis Matemático II',
      'clase 01.md',
    ])
  })
})

describe('validateVaultPath — normalisation', () => {
  it('drops redundant current-directory segments', () => {
    expect(accept('./Materias/./nota.md')).toEqual(['Materias', 'nota.md'])
  })

  it('normalises a leading and trailing slash without treating it as absolute', () => {
    // A caller that joins strings tends to produce these. They are sloppy, not
    // hostile, and must not be confused with /etc/passwd.
    expect(accept('Materias/')).toEqual(['Materias'])
  })
})

describe('isSafeSegment', () => {
  it('is the single rule the whole resolver is built from', () => {
    expect(isSafeSegment('nota.md')).toBe(true)
    expect(isSafeSegment('..')).toBe(false)
    expect(isSafeSegment('CON')).toBe(false)
    expect(isSafeSegment('a/b')).toBe(false)
  })
})
