import type { AcademicItemKind } from '@/domain/types'

const KIND_LABEL: Record<AcademicItemKind, string> = {
  task: 'Tarea',
  assignment: 'Entrega',
  midterm: 'Parcial',
  final: 'Final',
  registration: 'Inscripción',
  class: 'Clase',
  custom: 'Otro',
}

/** What a student calls each kind of item: "Parcial", "Entrega". */
export function itemKindLabel(kind: AcademicItemKind): string {
  return KIND_LABEL[kind]
}
