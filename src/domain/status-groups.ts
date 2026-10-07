import type { SubjectStatus, SubjectView } from './types'

/**
 * The groups a student thinks in, shared by Materias (chips), the Tablero and —
 * deliberately exported for it — Hoy.
 *
 * `regularized` is NOT "Cursando": the class is done and a final is pending.
 * Folding it into Cursando made the "Cursando" chip count subjects nobody is
 * attending, and the chip disagreed with what the list showed.
 */

export type StatusGroupId = 'disponibles' | 'cursando' | 'final_pendiente' | 'aprobadas'

/** Left to right, the order of an academic year. Chips and board columns both follow it. */
export const STATUS_GROUPS: readonly { id: StatusGroupId; label: string }[] = [
  { id: 'disponibles', label: 'Disponibles' },
  { id: 'cursando', label: 'Cursando' },
  { id: 'final_pendiente', label: 'Final pendiente' },
  { id: 'aprobadas', label: 'Aprobadas' },
]

/**
 * How a subject's status reads, everywhere: chips, rows, the board, search.
 * One table so no screen words a status on its own ("Disponible" is a claim
 * about correlativas; the wording lives here, next to the groups it names).
 */
const STATUS_LABEL: Record<SubjectStatus, string> = {
  passed: 'Aprobada',
  equivalent: 'Equivalencia',
  in_progress: 'Cursando',
  regularized: 'Regularizada',
  available: 'Disponible para cursar',
  pending: 'Sin marcar',
  blocked: 'Bloqueada',
  failed: 'Desaprobada',
}

export function statusLabel(status: SubjectStatus): string {
  return STATUS_LABEL[status]
}

/** The group a status belongs to, or null for derived/negative states that are not a lane. */
export function statusGroupOf(status: SubjectStatus): StatusGroupId | null {
  switch (status) {
    case 'available':
      return 'disponibles'
    case 'in_progress':
      return 'cursando'
    case 'regularized':
      return 'final_pendiente'
    case 'passed':
    case 'equivalent':
      return 'aprobadas'
    case 'blocked':
    case 'pending':
    case 'failed':
      return null
  }
}

export function groupByStatus(
  views: readonly SubjectView[],
): Record<StatusGroupId, SubjectView[]> {
  const groups: Record<StatusGroupId, SubjectView[]> = {
    disponibles: [],
    cursando: [],
    final_pendiente: [],
    aprobadas: [],
  }
  for (const view of views) {
    const group = statusGroupOf(view.status)
    if (group) groups[group].push(view)
  }
  return groups
}

/**
 * Which Materias filter to open on: the first group, in order of "what am I doing
 * now", that actually has subjects. Opening on an empty list reads as a broken
 * page. `disponibles` is only a candidate when the plan's correlativas are known.
 */
export function defaultStatusFilter(
  counts: Readonly<Record<StatusGroupId, number>>,
  prerequisitesKnown: boolean,
): StatusGroupId | 'todas' {
  const order: StatusGroupId[] = ['cursando', 'final_pendiente']
  if (prerequisitesKnown) order.push('disponibles')
  order.push('aprobadas')
  return order.find((id) => counts[id] > 0) ?? 'todas'
}
