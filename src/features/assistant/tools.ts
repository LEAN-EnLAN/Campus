import type { AcademicItemKind, StoredSubjectStatus } from '@/domain/types'
import { combineDue } from '@/features/items/date-input'
import { dueDateLabel, dueTimeLabel } from '@/features/items/due'
import { itemKindLabel } from '@/features/items/kind-label'
import type { ToolDefinition, ToolResultBlock, ToolUseBlock } from '@/lib/ai/anthropic-client'

import {
  getPendingFinals,
  getPlanStatus,
  getUpcoming,
  whatIf,
  type AssistantData,
  type WhatIfChange,
} from './context'

/**
 * The assistant's tools. Four read-only, one that only PROPOSES: `propose_item`
 * never writes — it hands the UI a card that opens Quick capture prefilled, and
 * nothing is saved until the student presses Guardar there.
 */

const KINDS: readonly AcademicItemKind[] = [
  'assignment',
  'midterm',
  'final',
  'task',
  'registration',
  'class',
  'custom',
]
const SIM_STATUSES: readonly StoredSubjectStatus[] = [
  'in_progress',
  'regularized',
  'passed',
  'failed',
  'equivalent',
]

export const ASSISTANT_TOOLS: ToolDefinition[] = [
  {
    name: 'get_upcoming',
    description:
      'Fechas académicas del estudiante: vencidas, de hoy y de los próximos días (entregas, parciales, finales, inscripciones). Usala para "qué hago hoy" o para planificar la semana.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description: 'Cuántos días hacia adelante. Por defecto 14.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_plan_status',
    description:
      'Estado del plan de estudios: materias cursando, regularizadas, disponibles para cursar y bloqueadas con lo que les falta, con sus ids. Indica si las correlativas están publicadas.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_pending_finals',
    description:
      'Finales pendientes (materias regularizadas), ordenados por cuántos finales habilitan, con la fecha agendada si la hay y avisos de correlativas.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'what_if_simulation',
    description:
      'Simula cambios de estado SIN guardarlos y devuelve qué materias se abrirían para cursar, qué finales se habilitarían y qué se cerraría. Usá los ids de get_plan_status.',
    input_schema: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: 20,
          items: {
            type: 'object',
            properties: {
              subject_id: { type: 'string' },
              status: { type: ['string', 'null'], enum: [...SIM_STATUSES, null] },
            },
            required: ['subject_id', 'status'],
            additionalProperties: false,
          },
        },
      },
      required: ['changes'],
      additionalProperties: false,
    },
  },
  {
    name: 'propose_item',
    description:
      'Propone agregar una fecha (entrega, parcial, final, tarea…). NO guarda nada: muestra una tarjeta para que el estudiante la revise y la guarde. Solo con datos que el estudiante te dio; nunca inventes fechas.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título corto, ej. "TP 2".' },
        kind: { type: 'string', enum: [...KINDS] },
        subject_id: {
          type: ['string', 'null'],
          description: 'Id de la materia (de get_plan_status), o null.',
        },
        date: { type: ['string', 'null'], description: 'AAAA-MM-DD, o null si no hay fecha.' },
        time: { type: ['string', 'null'], description: 'HH:MM (24 h), o null.' },
      },
      required: ['title', 'kind'],
      additionalProperties: false,
    },
  },
].map((tool) => ({ ...tool, eager_input_streaming: true }))

/** A new item the assistant suggests. Becomes Quick capture's `initialValues`. */
export interface ItemProposal {
  title: string
  kind: AcademicItemKind
  kindLabel: string
  curriculumSubjectId: string | null
  subjectName: string | null
  dueAt: string | null
  /** "23/11 · 18:00", or null without a date. */
  whenLabel: string | null
}

export interface ToolOutcome {
  result: ToolResultBlock
  proposal?: ItemProposal
}

class InvalidInput extends Error {}

function record(input: unknown): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidInput('La entrada tiene que ser un objeto.')
  }
  return input as Record<string, unknown>
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw new InvalidInput(`${field} tiene que ser texto.`)
  return value.trim() || null
}

function parseChanges(input: Record<string, unknown>): WhatIfChange[] {
  const raw = input.changes
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 20) {
    throw new InvalidInput('changes tiene que ser una lista de 1 a 20 cambios.')
  }
  return raw.map((entry) => {
    const change = record(entry)
    const subjectId = optionalString(change.subject_id, 'subject_id')
    if (!subjectId) throw new InvalidInput('Cada cambio necesita subject_id.')
    const status = change.status ?? null
    if (status !== null && !SIM_STATUSES.includes(status as StoredSubjectStatus)) {
      throw new InvalidInput(`Estado inválido: ${String(status)}.`)
    }
    return { subjectId, status: status as StoredSubjectStatus | null }
  })
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})$/

export function parseProposal(input: unknown, data: AssistantData): ItemProposal {
  const fields = record(input)
  const title = optionalString(fields.title, 'title')
  if (!title || title.length > 120)
    throw new InvalidInput('title es obligatorio (hasta 120 caracteres).')
  const kind = fields.kind
  if (!KINDS.includes(kind as AcademicItemKind)) throw new InvalidInput('kind no es válido.')

  const subjectId = optionalString(fields.subject_id, 'subject_id')
  const subject = subjectId ? data.views.find((view) => view.id === subjectId) : undefined
  if (subjectId && !subject) throw new InvalidInput(`No existe la materia ${subjectId}.`)

  const dateText = optionalString(fields.date, 'date')
  const timeText = optionalString(fields.time, 'time')
  let dueAt: string | null = null
  if (dateText) {
    const d = DATE_RE.exec(dateText)
    const date = d ? { year: Number(d[1]), month: Number(d[2]), day: Number(d[3]) } : null
    const probe = date ? new Date(date.year, date.month - 1, date.day) : null
    if (
      !date ||
      !probe ||
      probe.getMonth() !== date.month - 1 ||
      probe.getDate() !== date.day
    ) {
      throw new InvalidInput('date tiene que ser AAAA-MM-DD válida.')
    }
    const t = timeText ? TIME_RE.exec(timeText) : null
    if (timeText && (!t || Number(t[1]) > 23 || Number(t[2]) > 59)) {
      throw new InvalidInput('time tiene que ser HH:MM.')
    }
    dueAt = combineDue(date, t ? { hours: Number(t[1]), minutes: Number(t[2]) } : null)
  }

  const item = { dueAt, startsAt: null }
  const time = dueAt ? dueTimeLabel(item) : null
  return {
    title,
    kind: kind as AcademicItemKind,
    kindLabel: itemKindLabel(kind as AcademicItemKind),
    curriculumSubjectId: subject?.id ?? null,
    subjectName: subject?.name ?? null,
    dueAt,
    whenLabel: dueAt ? `${dueDateLabel(item)}${time ? ` · ${time}` : ''}` : null,
  }
}

function ok(id: string, body: unknown): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: id, content: JSON.stringify(body) }
}

function fail(id: string, message: string): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: id, content: message, is_error: true }
}

/** Run one tool call against the student's data. Never throws. */
export function dispatchTool(
  block: ToolUseBlock,
  data: AssistantData,
  options: { invalidJson?: boolean } = {},
): ToolOutcome {
  if (options.invalidJson) {
    return { result: fail(block.id, 'INVALID_JSON: la entrada no era JSON válido. Reintentá.') }
  }
  try {
    switch (block.name) {
      case 'get_upcoming': {
        const days = record(block.input).days
        if (days !== undefined && (typeof days !== 'number' || !Number.isFinite(days))) {
          throw new InvalidInput('days tiene que ser un número.')
        }
        return { result: ok(block.id, getUpcoming(data, typeof days === 'number' ? days : 14)) }
      }
      case 'get_plan_status':
        return { result: ok(block.id, getPlanStatus(data)) }
      case 'get_pending_finals':
        return { result: ok(block.id, getPendingFinals(data)) }
      case 'what_if_simulation':
        return { result: ok(block.id, whatIf(data, parseChanges(record(block.input)))) }
      case 'propose_item': {
        const proposal = parseProposal(block.input, data)
        return {
          proposal,
          result: ok(block.id, {
            mostrado: true,
            guardado: false,
            nota: 'La propuesta se mostró como tarjeta. No se guardó nada: el estudiante la revisa y la guarda.',
          }),
        }
      }
      default:
        return { result: fail(block.id, `Herramienta desconocida: ${block.name}.`) }
    }
  } catch (error) {
    const message = error instanceof InvalidInput ? error.message : 'No se pudo leer el dato.'
    return { result: fail(block.id, message) }
  }
}

export const SYSTEM_PROMPT = `Sos el asistente de estudio de Campus, una app para estudiantes universitarios argentinos. Hablás en español rioplatense (voseo), con calidez y sin vueltas.

Cómo respondés:
- Corto y concreto: lo importante primero, listas breves cuando ayudan. Nada de relleno.
- Usá las herramientas para leer los datos reales del estudiante antes de responder sobre sus fechas, materias o finales. No adivines.
- Nunca inventes correlativas, fechas, notas, horarios ni reglas de la facultad. Si un dato no está en Campus, decilo ("no tengo cargada esa fecha", "tu plan no publica las correlativas") y sugerí cargarlo.
- Si las correlativas no están publicadas, no afirmes qué materia habilita a cuál.
- Para agregar una fecha usá propose_item solo con datos que el estudiante te dio. Aclarale que se guarda recién cuando la confirma.
- Usá los términos de la cursada: materia, cursada, correlativa, parcial, final, TP, regularizar, cuatrimestre.
- No des consejos médicos, legales ni de trámites que no puedas verificar.`
