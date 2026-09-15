import { useMemo } from 'react'

import { StatusGlyph, statusLabel } from '@/components/academic-status'
import { KanbanBoard, type KanbanColumn } from '@/components/ui/kanban-board'
import type { SubjectView } from '@/domain/types'
import { useAcademicPlan, useSetSubjectStatus } from '@/features/academic/queries'

import { buildSubjectBoard, statusForColumn, type BoardColumnId } from './subject-board'

const TERM_LABEL: Record<SubjectView['term'], string> = {
  anual: 'Anual',
  '1c': '1° cuatr.',
  '2c': '2° cuatr.',
}

/**
 * The plan as a board.
 *
 * Same vocabulary as `SubjectRow` — glyph, name, a muted metadata line — moved
 * onto a card, because dragging is the point and a hairline row has nothing to
 * grab.
 */
function SubjectCard({ subject }: { subject: SubjectView }) {
  const missing = subject.missingRequirements

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <StatusGlyph status={subject.status} className="mt-0.5" />
        <span className="min-w-0 flex-1 text-sm">{subject.name}</span>
      </div>

      <span className="text-ink-muted flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs">
        <span>{subject.yearLevel}° año</span>
        <span aria-hidden="true">·</span>
        <span>{TERM_LABEL[subject.term]}</span>
        {subject.code ? (
          <>
            <span aria-hidden="true">·</span>
            <span data-numeric>{subject.code}</span>
          </>
        ) : null}
        {subject.grade !== null ? (
          <>
            <span aria-hidden="true">·</span>
            <span data-numeric>Nota {subject.grade}</span>
          </>
        ) : null}
      </span>

      {/*
        Shown, never enforced. Our correlativa data can be incomplete — the plan
        distinguishes "no las tenemos" from "no tiene" — so a subject we believe
        is bloqueada may be one the student is legitimately cursando. The card
        says what we know and lets them move it anyway.
      */}
      {missing.length > 0 ? (
        <span className="text-ink-muted pl-6 text-xs">
          {statusLabel(subject.status)} · falta {missing[0]?.name}
          {missing.length > 1 ? ` +${missing.length - 1}` : ''}
        </span>
      ) : null}
    </div>
  )
}

export function SubjectBoardView() {
  const plan = useAcademicPlan()
  const setStatus = useSetSubjectStatus()

  const board = useMemo(() => buildSubjectBoard(plan.views), [plan.views])

  const columns: KanbanColumn<SubjectView>[] = board.columns.map((column) => ({
    id: column.id,
    name: column.name,
    count: column.subjects.length,
    cards: column.subjects,
    empty:
      column.id === 'disponibles'
        ? 'Nada habilitado por ahora.'
        : column.id === 'cursando'
          ? 'Arrastrá una materia acá cuando la empieces.'
          : 'Todavía no aprobaste ninguna.',
  }))

  return (
    <div className="flex flex-col gap-3">
      <KanbanBoard
        columns={columns}
        label="Materias por estado"
        renderCard={(subject) => <SubjectCard subject={subject} />}
        onMove={({ cardId, from, to }) => {
          // Reordering inside a column is not persisted anywhere — the order is
          // the plan's, not the student's — so a same-column move would write
          // the status it already has, for nothing.
          if (from === to) return
          setStatus.mutate({
            curriculumSubjectId: cardId,
            status: statusForColumn(to as BoardColumnId),
          })
        }}
      />

      {board.offBoard.length > 0 ? (
        <p className="text-ink-muted text-xs">
          {board.offBoard.length}{' '}
          {board.offBoard.length === 1 ? 'materia no entra' : 'materias no entran'} en el
          tablero (bloqueadas, pendientes o desaprobadas). Mirálas con el filtro «Todas».
        </p>
      ) : null}
    </div>
  )
}
