import { manualProblem } from './manual-subjects'
import type { StoredSubjectStatus, Term } from './types'

/**
 * "Importar materias" — turn a pasted list or a .csv/.json file into the
 * student's OWN manual subjects.
 *
 * Nothing here is catalog data: every row is something the student typed
 * somewhere else (a spreadsheet, a note) and Campus only reads it back. The
 * parser is pure and forgiving about format (Excel es-AR exports `;`, a BOM,
 * quotes, CRLF, tabs when pasting cells) and strict about content: a value it
 * does not recognise is a visible row problem, never a guess.
 */

export const IMPORT_MAX_ROWS = 300

export const IMPORT_TEMPLATE_CSV =
  'nombre;año;cuatrimestre;estado\r\n' + 'Nombre de la materia;1;1c;cursando\r\n'

export interface RawImportRow {
  /** 1-based line (CSV) or position (JSON) in what the student gave us. */
  line: number
  name: string
  yearLevel: number
  /** null when the row does not say; the dialog fills it with the student's choice. */
  term: Term | null
  /** null when the row does not say, or says "pendiente". */
  status: StoredSubjectStatus | null
  /** A content problem found while reading (unknown term or status). */
  problem: string | null
}

export type ParseImportResult =
  { ok: true; rows: RawImportRow[] } | { ok: false; error: string }

/** Lowercase, no accents, collapsed whitespace — for comparing what people type. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// --- Values -----------------------------------------------------------------

/** "1", "1c", "1°", "primero", "1er cuatrimestre", "anual"… → Term. */
export function parseTerm(value: string): Term | null | undefined {
  const s = foldText(value)
    .replace(/[°º.]/g, '')
    .replace(/cuatrimestre|cuatri|cuat/g, '')
    .replace(/\s+/g, '')
  if (s === '') return null
  if (s === 'anual' || s === 'a') return 'anual'
  if (['1', '1c', 'c1', '1er', '1ro', 'primer', 'primero', 'primera'].includes(s)) return '1c'
  if (['2', '2c', 'c2', '2do', 'segundo', 'segunda'].includes(s)) return '2c'
  return undefined
}

const STATUS_WORDS: Record<string, StoredSubjectStatus | null> = {
  aprobada: 'passed',
  aprobado: 'passed',
  promocionada: 'passed',
  promocionado: 'passed',
  passed: 'passed',
  regular: 'regularized',
  regularizada: 'regularized',
  regularizado: 'regularized',
  'final pendiente': 'regularized',
  regularized: 'regularized',
  cursando: 'in_progress',
  'en curso': 'in_progress',
  in_progress: 'in_progress',
  desaprobada: 'failed',
  desaprobado: 'failed',
  failed: 'failed',
  equivalencia: 'equivalent',
  equivalente: 'equivalent',
  equivalent: 'equivalent',
  pendiente: null,
  'sin marcar': null,
  'por cursar': null,
  pending: null,
}

/** es-AR status words → stored status. `undefined` means "not recognised". */
export function parseStatus(value: string): StoredSubjectStatus | null | undefined {
  const s = foldText(value)
  if (s === '') return null
  return Object.hasOwn(STATUS_WORDS, s) ? STATUS_WORDS[s] : undefined
}

/** "1", "1°", "2do", "3er año" → 1, 2, 3. Anything else → NaN, which manualProblem rejects. */
export function parseYear(value: string | number): number {
  if (typeof value === 'number') return value
  const match = /^\s*(\d+)/.exec(value)
  return match ? Number(match[1]) : Number.NaN
}

function toRow(
  line: number,
  name: string,
  year: string | number,
  termText: string,
  statusText: string,
): RawImportRow {
  const term = parseTerm(termText)
  const status = parseStatus(statusText)
  let problem: string | null = null
  if (term === undefined) problem = `No reconocemos el cuatrimestre "${termText.trim()}".`
  else if (status === undefined) problem = `No reconocemos el estado "${statusText.trim()}".`
  return {
    line,
    name: name.trim(),
    yearLevel: parseYear(year),
    term: term ?? null,
    status: status ?? null,
    problem,
  }
}

// --- CSV ----------------------------------------------------------------------

function detectSeparator(firstLine: string): string {
  const count = (ch: string) => firstLine.split(ch).length - 1
  if (count('\t') > 0) return '\t'
  return count(';') >= count(',') && count(';') > 0 ? ';' : ','
}

/** RFC 4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
function splitCsv(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field.trim() === '') {
      field = ''
      quoted = true
    } else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  rows.push(row)
  return rows
}

const HEADER_WORDS = new Set(['nombre', 'materia', 'name', 'asignatura'])

function parseCsv(text: string): ParseImportResult {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const table = splitCsv(text, detectSeparator(firstLine))
  const rows: RawImportRow[] = []
  table.forEach((cells, index) => {
    if (cells.every((c) => c.trim() === '')) return
    if (rows.length === 0 && HEADER_WORDS.has(foldText(cells[0] ?? ''))) return
    rows.push(toRow(index + 1, cells[0] ?? '', cells[1] ?? '', cells[2] ?? '', cells[3] ?? ''))
  })
  return { ok: true, rows }
}

// --- JSON ---------------------------------------------------------------------

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (key in record) return record[key]
  return undefined
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function parseJson(text: string): ParseImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El JSON no se puede leer. Revisá comas y llaves.' }
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: 'El JSON tiene que ser una lista: [{ "name": …, "year": … }].' }
  }
  const rows = data.map((entry: unknown, index): RawImportRow => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return {
        line: index + 1,
        name: '',
        yearLevel: Number.NaN,
        term: null,
        status: null,
        problem: 'Esta entrada no es una materia.',
      }
    }
    const record = entry as Record<string, unknown>
    const year = pick(record, ['year', 'año', 'yearLevel', 'anio'])
    return toRow(
      index + 1,
      asText(pick(record, ['name', 'nombre'])),
      typeof year === 'number' ? year : asText(year),
      asText(pick(record, ['term', 'cuatrimestre'])),
      asText(pick(record, ['status', 'estado'])),
    )
  })
  return { ok: true, rows }
}

/** Read pasted text or a file's contents. JSON when it looks like JSON, CSV otherwise. */
export function parsePlanImport(input: string): ParseImportResult {
  const text = input.replace(/^\uFEFF/, '')
  if (text.trim() === '') return { ok: true, rows: [] }
  const result = text.trimStart().startsWith('[') ? parseJson(text) : parseCsv(text)
  if (result.ok && result.rows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `Podés importar hasta ${IMPORT_MAX_ROWS} materias por vez.`,
    }
  }
  return result
}

// --- Resolution against what the student already has ------------------------

export type ImportRowOutcome = 'ready' | 'invalid' | 'duplicate'

export interface ImportRow {
  line: number
  name: string
  yearLevel: number
  term: Term
  status: StoredSubjectStatus | null
  outcome: ImportRowOutcome
  /** Why the row will not be imported; null when it is ready. */
  reason: string | null
}

/**
 * Decide each row: ready, invalid (with the same words the manual form uses)
 * or duplicate — of a subject already loaded or of an earlier row in the list.
 * Names compare without case or accents: "Fisica I" is "Física I".
 */
export function resolveImport(
  rows: readonly RawImportRow[],
  existingNames: readonly string[],
  defaultTerm: Term,
): ImportRow[] {
  const existing = new Set(existingNames.map(foldText))
  const seen = new Set<string>()
  return rows.map((raw) => {
    const term = raw.term ?? defaultTerm
    const base = {
      line: raw.line,
      name: raw.name,
      yearLevel: raw.yearLevel,
      term,
      status: raw.status,
    }
    const problem =
      raw.problem ?? manualProblem({ name: raw.name, yearLevel: raw.yearLevel, term })
    if (problem) return { ...base, outcome: 'invalid', reason: problem }
    const key = foldText(raw.name)
    if (existing.has(key)) {
      return { ...base, outcome: 'duplicate', reason: 'Ya está cargada.' }
    }
    if (seen.has(key)) {
      return { ...base, outcome: 'duplicate', reason: 'Repetida en la lista.' }
    }
    seen.add(key)
    return { ...base, outcome: 'ready', reason: null }
  })
}
