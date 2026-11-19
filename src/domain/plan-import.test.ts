import { describe, expect, it } from 'vitest'

import {
  IMPORT_MAX_ROWS,
  IMPORT_TEMPLATE_CSV,
  parsePlanImport,
  parseStatus,
  parseTerm,
  parseYear,
  resolveImport,
  type RawImportRow,
} from './plan-import'

function rows(text: string): RawImportRow[] {
  const result = parsePlanImport(text)
  if (!result.ok) throw new Error(result.error)
  return result.rows
}

describe('parsePlanImport — CSV', () => {
  it('reads an Excel es-AR export: BOM, ; separator, header, CRLF, quoted fields', () => {
    const text =
      '\uFEFFnombre;año;cuatrimestre;estado\r\n' +
      'Materia A;1;1c;aprobada\r\n' +
      '"Materia; con punto y coma";2;2°;Cursando\r\n'
    expect(rows(text)).toEqual([
      { line: 2, name: 'Materia A', yearLevel: 1, term: '1c', status: 'passed', problem: null },
      {
        line: 3,
        name: 'Materia; con punto y coma',
        yearLevel: 2,
        term: '2c',
        status: 'in_progress',
        problem: null,
      },
    ])
  })

  it('accepts comma separators, no header, and only name + year', () => {
    expect(rows('Materia A,1\nMateria B,3\n')).toEqual([
      { line: 1, name: 'Materia A', yearLevel: 1, term: null, status: null, problem: null },
      { line: 2, name: 'Materia B', yearLevel: 3, term: null, status: null, problem: null },
    ])
  })

  it('accepts tab-separated cells pasted from a spreadsheet', () => {
    expect(rows('Materia A\t2\tanual')[0]).toMatchObject({ yearLevel: 2, term: 'anual' })
  })

  it('keeps doubled quotes and newlines inside quoted names', () => {
    expect(rows('"Taller ""B""";1')[0]?.name).toBe('Taller "B"')
  })

  it('skips blank lines', () => {
    expect(rows('\n\nMateria A;1\n\n')).toHaveLength(1)
  })

  it('marks an unknown term or status as a row problem instead of guessing', () => {
    const [a, b] = rows('Materia A;1;tercero\nMateria B;1;1c;libre')
    expect(a?.problem).toBe('No reconocemos el cuatrimestre "tercero".')
    expect(b?.problem).toBe('No reconocemos el estado "libre".')
  })

  it('returns no rows for empty input', () => {
    expect(rows('   ')).toEqual([])
  })

  it('refuses more than the row limit', () => {
    const text = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `M${i};1`).join('\n')
    expect(parsePlanImport(text)).toEqual({
      ok: false,
      error: `Podés importar hasta ${IMPORT_MAX_ROWS} materias por vez.`,
    })
  })

  it('parses its own template', () => {
    expect(rows(IMPORT_TEMPLATE_CSV)).toEqual([
      {
        line: 2,
        name: 'Nombre de la materia',
        yearLevel: 1,
        term: '1c',
        status: 'in_progress',
        problem: null,
      },
    ])
  })
})

describe('parsePlanImport — JSON', () => {
  it('reads an array of {name, year, term?, status?}', () => {
    const text = JSON.stringify([
      { name: 'Materia A', year: 1 },
      { nombre: 'Materia B', año: '2', cuatrimestre: '1', estado: 'regular' },
    ])
    expect(rows(text)).toEqual([
      { line: 1, name: 'Materia A', yearLevel: 1, term: null, status: null, problem: null },
      {
        line: 2,
        name: 'Materia B',
        yearLevel: 2,
        term: '1c',
        status: 'regularized',
        problem: null,
      },
    ])
  })

  it('explains malformed JSON and a non-array', () => {
    expect(parsePlanImport('[{"name":')).toMatchObject({ ok: false })
    expect(parsePlanImport('[1]')).toMatchObject({ ok: true })
    expect(rows('[1]')[0]?.problem).toBe('Esta entrada no es una materia.')
  })
})

describe('value parsing', () => {
  it.each([
    ['1', '1c'],
    ['1C', '1c'],
    ['1°', '1c'],
    ['1º cuatrimestre', '1c'],
    ['primero', '1c'],
    ['1er cuatrimestre', '1c'],
    ['2', '2c'],
    ['Segundo', '2c'],
    ['2do', '2c'],
    ['Anual', 'anual'],
    ['', null],
  ])('term %j → %j', (input, expected) => {
    expect(parseTerm(input)).toBe(expected)
  })

  it('does not recognise an invented term', () => {
    expect(parseTerm('3c')).toBeUndefined()
  })

  it.each([
    ['Aprobada', 'passed'],
    ['promocionada', 'passed'],
    ['Regularizada', 'regularized'],
    ['regular', 'regularized'],
    ['cursando', 'in_progress'],
    ['En curso', 'in_progress'],
    ['desaprobada', 'failed'],
    ['Equivalencia', 'equivalent'],
    ['pendiente', null],
    ['', null],
  ])('status %j → %j', (input, expected) => {
    expect(parseStatus(input)).toBe(expected)
  })

  it('does not treat object keys as statuses', () => {
    expect(parseStatus('constructor')).toBeUndefined()
  })

  it('reads years written the Argentine way', () => {
    expect(parseYear('3°')).toBe(3)
    expect(parseYear('2do año')).toBe(2)
    expect(parseYear('primero')).toBeNaN()
  })
})

describe('resolveImport', () => {
  const raw = (over: Partial<RawImportRow>): RawImportRow => ({
    line: 1,
    name: 'Materia A',
    yearLevel: 1,
    term: null,
    status: null,
    problem: null,
    ...over,
  })

  it('fills a missing term with the chosen default', () => {
    expect(resolveImport([raw({})], [], '2c')[0]).toMatchObject({
      term: '2c',
      outcome: 'ready',
    })
  })

  it('reuses the manual form validation for name and year', () => {
    const [blank, year] = resolveImport(
      [raw({ name: '' }), raw({ name: 'X', yearLevel: 11 })],
      [],
      'anual',
    )
    expect(blank).toMatchObject({
      outcome: 'invalid',
      reason: 'Escribí el nombre de la materia.',
    })
    expect(year).toMatchObject({ outcome: 'invalid', reason: 'Elegí un año entre 1 y 10.' })
  })

  it('skips subjects already loaded and repeats in the list, ignoring case and accents', () => {
    const resolved = resolveImport(
      [
        raw({ line: 1, name: 'Fisica I' }),
        raw({ line: 2, name: 'Química' }),
        raw({ line: 3, name: 'QUIMICA' }),
      ],
      ['Física I'],
      'anual',
    )
    expect(resolved.map((r) => [r.outcome, r.reason])).toEqual([
      ['duplicate', 'Ya está cargada.'],
      ['ready', null],
      ['duplicate', 'Repetida en la lista.'],
    ])
  })

  it('keeps a parse problem ahead of other checks', () => {
    expect(
      resolveImport([raw({ problem: 'No reconocemos el estado "x".' })], [], 'anual')[0],
    ).toMatchObject({ outcome: 'invalid', reason: 'No reconocemos el estado "x".' })
  })
})
