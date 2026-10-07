import type { AcademicItem, SubjectView } from '@/domain/types'

import { anchorOf } from './due'

/**
 * The one soft check on scheduling a Final.
 *
 * Agreed position (professor and student): never block, never a modal. A Final
 * is booked ahead of time and two sequential finals in one turno are normal, so
 * the note fires only when a subject the plan says must be PASSED first is
 * neither passed (or an equivalencia) nor scheduled to be, on an earlier day.
 *
 * Reads the domain's `missingRequirements` and nothing else: if the plan has no
 * published correlativas there is nothing to compare against, and this says
 * nothing rather than invent a rule.
 */

export interface FinalNote {
  /** Names of the subjects still to be passed before this Final. */
  missing: string[]
}

function dayOf(iso: string | null): number | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function finalPrerequisiteNote(
  candidate: Pick<AcademicItem, 'kind' | 'curriculumSubjectId' | 'dueAt' | 'startsAt'>,
  views: readonly SubjectView[],
  items: readonly Pick<
    AcademicItem,
    'kind' | 'curriculumSubjectId' | 'dueAt' | 'startsAt' | 'status'
  >[],
): FinalNote | null {
  if (candidate.kind !== 'final' || !candidate.curriculumSubjectId) return null
  const day = dayOf(anchorOf(candidate))
  if (day === null) return null

  const subject = views.find((v) => v.id === candidate.curriculumSubjectId)
  if (!subject) return null

  const missing = new Map<string, string>()
  for (const requirement of subject.missingRequirements) {
    // Only "para rendir": a gap for cursar is not what a Final waits on.
    if (requirement.needs !== 'aprobar') continue

    const scheduledEarlier = items.some((item) => {
      if (item.kind !== 'final' || item.status === 'cancelled') return false
      if (item.curriculumSubjectId !== requirement.curriculumSubjectId) return false
      const other = dayOf(anchorOf(item))
      return other !== null && other < day
    })
    if (!scheduledEarlier) missing.set(requirement.curriculumSubjectId, requirement.name)
  }

  return missing.size > 0 ? { missing: [...missing.values()] } : null
}

/** The sentence shown under the form. Informational: it never blocks saving. */
export function finalNoteSentence(note: FinalNote): string {
  const names = note.missing
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
  const aprobada = names.length === 1 ? 'aprobada' : 'aprobadas'
  return `El plan pide tener ${aprobada} ${list} antes de rendir este final, y todavía no figura aprobada ni con un final antes de esta fecha. Si ya lo resolviste o es una equivalencia, ignorá este aviso.`
}
