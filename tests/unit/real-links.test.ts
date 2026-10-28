import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync as nativeSymlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { nativeFileSymlinksAvailable, symlinkSync } from '../support/real-links'

const temporary: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'campus-link-regression-'))
  temporary.push(root)
  return root
}

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true })
})

describe('real filesystem links — no Windows POSIX substitute', () => {
  it('exercises a genuine directory reparse point/junction or POSIX symlink', () => {
    const root = fixture()
    const dir = join(root, 'real')
    mkdirSync(dir)
    const alias = join(root, 'alias')
    symlinkSync(dir, alias)
    expect(lstatSync(alias).isSymbolicLink()).toBe(true)
  })

  it.skipIf(!nativeFileSymlinksAvailable)(
    'exercises a genuine native file symlink where permitted',
    () => {
      const root = fixture()
      const file = join(root, 'file.txt')
      writeFileSync(file, 'security')
      const alias = join(root, 'alias.txt')
      nativeSymlinkSync(file, alias, 'file')
      expect(lstatSync(alias).isSymbolicLink()).toBe(true)
    },
  )
})
