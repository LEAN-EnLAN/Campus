import {
  CircleCheck,
  CircleDashed,
  CircleEqual,
  CircleX,
  Circle,
  Clock3,
  Contrast,
  LockKeyhole,
  type LucideIcon,
} from 'lucide-react'

import type { StatusGroupId } from '@/domain/status-groups'
import type { SubjectStatus } from '@/domain/types'

/**
 * The one status vocabulary: icon, tone and word, used by the row glyph, the
 * status control, the Materias filters and the summary panels.
 *
 * Colour is never the only carrier of state. Every status has its own SHAPE
 * (dashed ring → ring → half-filled → clock → check), so a colour-blind student,
 * a greyscale print and a screen reader (via the label) all read the same thing.
 * The progression follows the academic year: nothing yet, can take it, taking
 * it, final pending, done.
 */

export interface StatusSpec {
  Icon: LucideIcon
  /** Glyph colour. */
  tone: string
  /** Tinted chip: soft fill + the text-safe ink of the same role (section 1 table). */
  chip: string
}

export const STATUS: Record<SubjectStatus, StatusSpec> = {
  pending: {
    Icon: CircleDashed,
    tone: 'text-ink-muted',
    chip: 'bg-paper-sunken text-ink-muted',
  },
  available: {
    Icon: Circle,
    tone: 'text-ink',
    chip: 'bg-paper-sunken text-ink',
  },
  in_progress: {
    // Half-filled: "under way", the shape Linear and GitHub use for in progress.
    Icon: Contrast,
    tone: 'text-accent-ink [&_path]:fill-current',
    chip: 'bg-accent-soft text-accent-ink',
  },
  regularized: {
    Icon: Clock3,
    tone: 'text-warning',
    chip: 'bg-warning-soft text-warning',
  },
  passed: {
    Icon: CircleCheck,
    tone: 'text-success-ink',
    chip: 'bg-success-soft text-success-ink',
  },
  equivalent: {
    Icon: CircleEqual,
    tone: 'text-success-ink',
    chip: 'bg-success-soft text-success-ink',
  },
  blocked: {
    Icon: LockKeyhole,
    tone: 'text-ink-muted',
    // Not a result: an outline, not a fill.
    chip: 'border-rule border-dashed text-ink-muted',
  },
  failed: {
    Icon: CircleX,
    tone: 'text-danger',
    chip: 'bg-danger-soft text-danger',
  },
}

/**
 * The status that stands for each Materias group, so a filter shows the same
 * glyph as the rows it lists.
 */
export const GROUP_STATUS: Readonly<Record<StatusGroupId, SubjectStatus>> = {
  disponibles: 'available',
  cursando: 'in_progress',
  final_pendiente: 'regularized',
  aprobadas: 'passed',
}

/** Tinted chip classes (fill + text) for a status. */
export function statusChipClass(status: SubjectStatus): string {
  return STATUS[status].chip
}
