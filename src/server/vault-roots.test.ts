import { delimiter, join, parse, resolve, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isInsideAny, parseAllowedRoots } from './vault-roots'

// Use the host filesystem's root, not POSIX paths whose meaning changes
// on Windows (e.g. '/srv' resolves to 'C:\srv').
const ANCHOR = parse(resolve()).root
const HOME = join(ANCHOR, 'home', 'estudiante')
const VAULTS = join(ANCHOR, 'srv', 'vaults')
const USB = join(ANCHOR, 'mnt', 'usb')
const OK = join(ANCHOR, 'ok')

describe('parseAllowedRoots', () => {
  it('defaults to the home directory when nothing is set', () => {
    expect(parseAllowedRoots(undefined, HOME).roots).toEqual([resolve(HOME)])
    expect(parseAllowedRoots('', HOME).roots).toEqual([resolve(HOME)])
    expect(parseAllowedRoots('   ', HOME).roots).toEqual([resolve(HOME)])
  })

  it('an explicit list REPLACES the default, it does not extend it', () => {
    const { roots } = parseAllowedRoots([VAULTS, USB].join(delimiter), HOME)
    expect(roots).toEqual([VAULTS, USB])
    expect(roots).not.toContain(HOME)
  })

  it('normalises trailing slashes and dot segments', () => {
    expect(parseAllowedRoots(VAULTS + sep, HOME).roots).toEqual([VAULTS])
    expect(
      parseAllowedRoots([join(ANCHOR, 'srv'), '.', 'vaults', '..', 'vaults'].join(sep), HOME)
        .roots,
    ).toEqual([VAULTS])
    expect(parseAllowedRoots([VAULTS, VAULTS + sep].join(delimiter), HOME).roots).toEqual([
      VAULTS,
    ])
  })

  it('drops what could never match instead of keeping a knob that is set but inert', () => {
    const badNul = join(ANCHOR, 'bad\0nul')
    const raw = ['relative/dir', '~/vaults', '', OK, badNul, '*'].join(delimiter)
    const { roots, rejected } = parseAllowedRoots(raw, HOME)
    expect(roots).toEqual([OK])
    expect(rejected).toEqual(['relative/dir', '~/vaults', badNul, '*'])
  })

  it('refuses the filesystem root: it would allow everything on this volume', () => {
    const { roots, rejected } = parseAllowedRoots(ANCHOR, HOME)
    expect(roots).toEqual([])
    expect(rejected).toEqual([ANCHOR])
  })

  it('a value that parses to nothing allows nothing; it never falls back to the default', () => {
    expect(parseAllowedRoots('relative', HOME).roots).toEqual([])
  })
})

describe('isInsideAny', () => {
  const ALLOWED = join(ANCHOR, 'home', 'a')

  it('matches the root itself and anything below it', () => {
    expect(isInsideAny([ALLOWED], ALLOWED)).toBe(true)
    expect(isInsideAny([ALLOWED], join(ALLOWED, 'vault', 'deep'))).toBe(true)
  })

  it('does not match a sibling that shares the prefix, or the parent', () => {
    expect(isInsideAny([ALLOWED], join(ANCHOR, 'home', 'ab'))).toBe(false)
    expect(isInsideAny([ALLOWED], join(ANCHOR, 'home'))).toBe(false)
    expect(isInsideAny([ALLOWED], join(ANCHOR, 'etc'))).toBe(false)
  })

  it('collapses dot segments before judging', () => {
    expect(isInsideAny([ALLOWED], resolve(ALLOWED, '..', '..', 'etc'))).toBe(false)
  })

  it('an empty list allows nothing', () => {
    expect(isInsideAny([], ALLOWED)).toBe(false)
  })
})
