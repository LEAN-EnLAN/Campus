import type { AvailabilityInput } from '@/domain/availability'
import { simulateViews, simulationDiff, TERM_LABEL } from '@/domain/simulation'
import { statusLabel } from '@/domain/status-groups'
import type { AcademicItem, StoredSubjectStatus, SubjectView } from '@/domain/types'
import { useAcademicPlan } from '@/features/academic/queries'
import { dueDateLabel, dueTimeLabel } from '@/features/items/due'
import { itemKindLabel } from '@/features/items/kind-label'
import { useAcademicItems } from '@/features/items/queries'
import { buildToday, type UpcomingEntry } from '@/features/items/today-model'
import { pendingFinalRows } from '@/features/plan/pending-finals-model'
import type { AgendaEntry } from '@/domain/agenda'

/**
 * What the assistant may know, and how little of it each answer sends.
 *
 * Nothing here is dumped into the prompt wholesale: the system prompt carries a
 * one-line header, and the model asks for the rest through read-only tools
 * (`tools.ts`) that call these functions. Only names, statuses, kinds and dates
 * leave the device — never item notes, emails or account data.
 */

export interface AssistantData {
  now: Date
  programName: string | null
  /** The carrera is not in the catalog: the student typed their subjects in. */
  isUnmapped: boolean
  /** Does the source publish correlativas at all? False → availability is unverified. */
  prerequisitesKnown: boolean
  prerequisitesNote: string | null
  views: SubjectView[]
  items: AcademicItem[]
  availabilityInput: AvailabilityInput | null
}

/** The student's real data, once both the plan and the items have loaded. */
export function useAssistantData(): { data: AssistantData | null; isLoading: boolean } {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const isLoading = plan.isLoading || itemsQuery.isLoading
  if (isLoading || !plan.hasContext) return { data: null, isLoading }
  return {
    isLoading: false,
    data: {
      now: new Date(),
      programName: plan.programName ?? plan.context?.unmappedLabel ?? null,
      isUnmapped: plan.isUnmapped,
      prerequisitesKnown: plan.prerequisitesKnown,
      prerequisitesNote: plan.prerequisitesNote,
      views: plan.views,
      items: itemsQuery.data ?? [],
      availabilityInput: plan.availabilityInput,
    },
  }
}

const DATE_LONG = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The few lines the model always gets: today's date and the shape of the plan. */
export function buildContextHeader(data: AssistantData): string {
  const counts = countByStatus(data.views)
  const open = data.items.filter((item) => item.status === 'open').length
  const lines = [
    `Hoy es ${DATE_LONG.format(data.now)} (${isoDay(data.now)}).`,
    data.programName ? `Carrera: ${data.programName}.` : 'Carrera: sin cargar.',
    data.isUnmapped
      ? 'El plan no está en el catálogo de Campus: el estudiante cargó sus materias a mano, sin correlativas.'
      : `Plan: ${data.views.length} materias (${counts.passed} aprobadas, ${counts.in_progress} cursando, ${counts.regularized} regularizadas).`,
    data.prerequisitesKnown
      ? 'Correlativas: publicadas por la fuente oficial.'
      : 'Correlativas: la fuente NO las publica; no afirmes qué materia habilita a cuál.',
    `Fechas abiertas cargadas: ${open}.`,
  ]
  return lines.join('\n')
}

function countByStatus(views: readonly SubjectView[]) {
  const counts = { passed: 0, in_progress: 0, regularized: 0 }
  for (const view of views) {
    if (view.status === 'passed' || view.status === 'equivalent') counts.passed++
    else if (view.status === 'in_progress') counts.in_progress++
    else if (view.status === 'regularized') counts.regularized++
  }
  return counts
}

// --- Tool bodies (pure) ----------------------------------------------------------

function subjectName(data: AssistantData, id: string | null): string | null {
  if (!id) return null
  return data.views.find((view) => view.id === id)?.name ?? null
}

function itemLine(data: AssistantData, entry: AgendaEntry | UpcomingEntry) {
  const { item } = entry
  return {
    titulo: item.title,
    tipo: itemKindLabel(item.kind),
    materia: subjectName(data, item.curriculumSubjectId),
    fecha: dueDateLabel(item),
    hora: dueTimeLabel(item),
    dias_restantes: entry.dayOffset,
  }
}

/** Overdue, today, and the next `days` days. Undated items are only counted by title. */
export function getUpcoming(data: AssistantData, days = 14) {
  const span = Math.min(Math.max(Math.round(days), 1), 60)
  const today = buildToday(data.items, data.now)
  const ahead = [...today.upcoming, ...today.later].filter((entry) => entry.daysLeft <= span)
  return {
    vencidas: today.overdue.map((entry) => itemLine(data, entry)),
    hoy: today.today.map((entry) => itemLine(data, entry)),
    proximas: ahead.map((entry) => itemLine(data, entry)),
    sin_fecha: today.undated.slice(0, 10).map((entry) => entry.item.title),
    mas_adelante: today.upcoming.length + today.later.length - ahead.length,
  }
}

const BLOCKED_LIMIT = 15

/** Subject states, grouped. Ids are included so a simulation can name subjects. */
export function getPlanStatus(data: AssistantData) {
  const brief = (view: SubjectView) => ({
    id: view.id,
    nombre: view.name,
    anio: view.yearLevel,
    cuatrimestre: TERM_LABEL[view.term],
  })
  const by = (...statuses: SubjectView['status'][]) =>
    data.views.filter((view) => statuses.includes(view.status))
  const blocked = by('blocked', 'pending')
  return {
    carrera: data.programName,
    plan_mapeado: !data.isUnmapped,
    correlativas_publicadas: data.prerequisitesKnown,
    nota_correlativas: data.prerequisitesKnown
      ? data.prerequisitesNote
      : (data.prerequisitesNote ??
        'La fuente no publica las correlativas: la disponibilidad no está verificada.'),
    total: data.views.length,
    aprobadas: by('passed', 'equivalent').length,
    cursando: by('in_progress').map(brief),
    regularizadas: by('regularized').map(brief),
    disponibles: by('available').map(brief),
    bloqueadas: blocked.slice(0, BLOCKED_LIMIT).map((view) => ({
      ...brief(view),
      estado: statusLabel(view.status),
      le_falta: view.missingRequirements.map((r) => `${r.needs} ${r.name}`),
    })),
    bloqueadas_sin_listar: Math.max(blocked.length - BLOCKED_LIMIT, 0),
    desaprobadas: by('failed').map(brief),
  }
}

/** Regularizadas, the one whose final habilita the most first (the plan screen's order). */
export function getPendingFinals(data: AssistantData) {
  const rows = pendingFinalRows(data.views, data.items, data.now)
  return {
    correlativas_publicadas: data.prerequisitesKnown,
    nota: data.prerequisitesKnown
      ? null
      : 'Sin correlativas publicadas: el orden no puede considerar qué final habilita a cuál.',
    finales: rows.map((row) => ({
      id: row.subject.id,
      materia: row.subject.name,
      habilita_el_final_de: row.opens.map((dep) =>
        dep.alsoNeeds.length
          ? `${dep.subject.name} (también pide ${dep.alsoNeeds.join(', ')})`
          : dep.subject.name,
      ),
      fecha_agendada: row.scheduled ? dueDateLabel(row.scheduled) : null,
      aviso: row.warning,
    })),
  }
}

export interface WhatIfChange {
  subjectId: string
  status: StoredSubjectStatus | null
}

/** "¿Qué se me abre si apruebo X?" — the domain simulator, nothing saved. */
export function whatIf(data: AssistantData, changes: readonly WhatIfChange[]) {
  if (!data.availabilityInput) {
    return {
      error: data.isUnmapped
        ? 'El plan no está en el catálogo y no tiene correlativas: no se puede simular.'
        : 'El plan todavía no cargó.',
    }
  }
  const unknown = changes.filter((c) => !data.views.some((v) => v.id === c.subjectId))
  if (unknown.length) {
    return { error: `No existen en el plan: ${unknown.map((c) => c.subjectId).join(', ')}` }
  }
  const hypotheses = new Map(changes.map((c) => [c.subjectId, c.status]))
  const diff = simulationDiff(data.views, simulateViews(data.availabilityInput, hypotheses))
  const names = (views: readonly SubjectView[]) => views.map((view) => view.name)
  return {
    supuestos: changes.map((c) => ({
      materia: subjectName(data, c.subjectId),
      estado: c.status ? statusLabel(c.status) : 'Sin marcar',
    })),
    se_abren_para_cursar: names(diff.cursar),
    se_habilitan_finales: names(diff.rendir),
    se_cierran: names(diff.closes),
    nota: data.prerequisitesKnown
      ? null
      : 'Sin correlativas publicadas: la simulación no puede mostrar qué se abre.',
  }
}
