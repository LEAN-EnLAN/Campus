import { describe, expect, it } from 'vitest'

import {
  formatFileSize,
  MATERIAL_MAX_BYTES,
  materialFileProblem,
  materialStoragePath,
  safeFileName,
  titleFromFileName,
} from './material-file'

describe('materialFileProblem', () => {
  it('accepts a PDF under 20 MB', () => {
    expect(
      materialFileProblem({ name: 'a.pdf', type: 'application/pdf', size: 1000 }),
    ).toBeNull()
  })
  it('refuses an empty file, an oversized one and a disallowed type', () => {
    expect(materialFileProblem({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(
      /vacío/,
    )
    expect(
      materialFileProblem({
        name: 'a.pdf',
        type: 'application/pdf',
        size: MATERIAL_MAX_BYTES + 1,
      }),
    ).toMatch(/20 MB/)
    expect(materialFileProblem({ name: 'a.html', type: 'text/html', size: 10 })).toMatch(/tipo/)
    expect(materialFileProblem({ name: 'a.exe', type: '', size: 10 })).toMatch(/tipo/)
  })
})

describe('safeFileName', () => {
  it('folds accents and spaces, keeps the extension', () => {
    expect(safeFileName('Apunte Álgebra 1° parcial.pdf')).toBe('Apunte-Algebra-1-parcial.pdf')
  })
  it('cannot traverse or carry separators', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd')
    expect(safeFileName('..\\..\\win.ini')).toBe('win.ini')
    expect(safeFileName('..')).toBe('archivo')
    expect(safeFileName('a\u0000b.pdf')).toBe('ab.pdf')
  })
  it('is never empty and never longer than 100 characters', () => {
    expect(safeFileName('')).toBe('archivo')
    expect(safeFileName('???.pdf')).toBe('archivo.pdf')
    expect(safeFileName(`${'x'.repeat(300)}.pdf`)).toHaveLength(100)
  })
})

describe('materialStoragePath', () => {
  it('keys the object under its owner', () => {
    expect(materialStoragePath('u1', 'id1', 'Guía TP 1.pdf')).toBe('u1/id1/Guia-TP-1.pdf')
  })
})

describe('titleFromFileName / formatFileSize', () => {
  it('suggests a readable title', () => {
    expect(titleFromFileName('guia_tp-2.pdf')).toBe('guia tp 2')
  })
  it('formats sizes in es-AR', () => {
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2,5 MB')
  })
})
