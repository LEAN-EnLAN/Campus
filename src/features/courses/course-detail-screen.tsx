import { Link } from '@tanstack/react-router'
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GitFork,
  Plus,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { StatusPicker } from '@/components/status-picker'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/domain/status-groups'
import {
  courseSummary,
  courseTimeline,
  relativeDayLabel,
  calendarDaysUntil,
} from '@/domain/course-summary'
import { ENTRY_OPTIONS, entryValueOf, type EntryOption } from '@/domain/progress-entry'
import type { AcademicItem, SubjectView } from '@/domain/types'
import { OrderConflictNote } from '@/features/academic/order-conflict-note'
import { useAcademicPlan, useSetSubjectStatus } from '@/features/academic/queries'
import {
  CorrelativasPanel,
  UnlocksList,
  correlativasNote,
} from '@/features/courses/correlativas-panel'
import { CourseFacts } from '@/features/courses/course-facts'
import { CourseMaterial } from '@/features/courses/course-material'
import { CourseSection } from '@/features/courses/course-section'
import { SubjectDateRow } from '@/features/courses/subject-dates'
import { SubjectNotes } from '@/features/courses/subject-notes'
import { useAcademicItems, useCreateAcademicItem, useResources } from '@/features/items/queries'
import { useCompleteItem } from '@/features/items/use-complete-item'
import { useItemActions } from '@/features/items/use-item-actions'

/** Every stored status, in the order of an academic year; Desaprobada last. */
const STATUS_OPTIONS: readonly EntryOption[] = [
  ...ENTRY_OPTIONS,
  { value: 'failed', label: 'Desaprobada', hint: 'Rendiste el final y no lo aprobaste' },
]

const TERM_LABEL = { anual: 'Anual', '1c': '1° cuatrimestre', '2c': '2° cuatrimestre' } as const

/** CAP-COURSE-001 — one materia: estado, fechas, correlativas, notas, material. */
export function CourseDetailScreen({ courseId }: { courseId: string }) {
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const resourcesQuery = useResources()
  const createItem = useCreateAcademicItem()
  // Same "done" as Hoy and the calendar: feedback, Deshacer, and a Final asks how it went.
  const completion = useCompleteItem((id) =>
    id ? (plan.subjectById.get(id)?.name ?? null) : null,
  )
  const itemActions = useItemActions({ subjects: plan.views, items: itemsQuery.data ?? [] })
  const [captureOpen, setCaptureOpen] = useState(false)
  const [now] = useState(() => new Date())

  const subject = plan.subjectById.get(courseId)
  const items = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.curriculumSubjectId === courseId),
    [itemsQuery.data, courseId],
  )
  const resources = useMemo(
    () => (resourcesQuery.data ?? []).filter((r) => r.curriculumSubjectId === courseId),
    [resourcesQuery.data, courseId],
  )

  if (plan.isLoading) return <LoadingRows rows={6} />
  if (plan.error) return <ErrorState error={plan.error} />

  if (!subject) {
    return (
      <div className="course-screen">
        <BackLink />
        <EmptyState
          illustration="course-not-found"
          title="No encontramos esta materia"
          description="Puede que no pertenezca al plan que tenés elegido."
        />
      </div>
    )
  }

  async function handleCapture(values: QuickCaptureValues) {
    // The dialog stays open and `createItem.error` is what the student reads; catching
    // here just keeps a failed save from surfacing as an unhandled rejection.
    try {
      await createItem.mutateAsync({
        title: values.title,
        kind: values.kind,
        curriculumSubjectId: courseId,
        dueAt: values.dueAt,
      })
      setCaptureOpen(false)
    } catch {
      /* surfaced through createItem.error */
    }
  }

  function openCapture() {
    if (createItem.isPending) return
    createItem.reset()
    setCaptureOpen(true)
  }

  const summary = courseSummary({
    subject,
    items,
    materialCount: resources.length,
    prerequisitesKnown: plan.prerequisitesKnown,
    now,
  })
  const unlocks = subject.unlocks
    .map((id) => plan.subjectById.get(id))
    .filter((s): s is SubjectView => s !== undefined)

  return (
    <div className="course-screen">
      <CourseHeader subject={subject} onAdd={openCapture} />

      <CourseFacts summary={summary} />

      <div className="course-sections">
        <CourseSection
          id="fechas"
          icon={<CalendarDays />}
          title="Próximas fechas"
          purpose="Parciales, entregas y finales de esta materia, por fecha."
        >
          {/* A failed fetch is not an empty list: telling the student "no tenés nada"
          here makes them re-add an entrega they already had. */}
          {itemsQuery.error ? (
            <ErrorState
              title="No pudimos cargar tus fechas"
              error={itemsQuery.error as Error}
              onRetry={() => void itemsQuery.refetch()}
            />
          ) : itemsQuery.isLoading ? (
            <LoadingRows rows={2} />
          ) : items.length === 0 ? (
            <EmptyState
              quiet
              className="[&_img]:max-w-36"
              illustration="course-tasks-empty"
              title="No tenés nada anotado para esta materia."
              action={
                <Button variant="secondary" onClick={openCapture}>
                  <Plus aria-hidden="true" />
                  Anotar la primera fecha
                </Button>
              }
            />
          ) : (
            <CourseDates
              items={items}
              now={now}
              rowProps={(item) => ({
                onToggle: (done) => completion.complete(item, done),
                togglePending: completion.isPending(item.id),
                onShare: () => void itemActions.share(item),
                onDownloadIcs: () => itemActions.downloadIcs(item),
                onEdit: () => itemActions.edit(item),
                onDelete: () => itemActions.remove(item),
              })}
            />
          )}
        </CourseSection>

        <CourseSection
          id="correlativas"
          icon={<GitFork />}
          title="Correlativas"
          purpose="Qué te pide esta materia y qué materias destraba."
        >
          <div className="flex flex-col gap-6">
            {subject.requirements.length > 0 ? (
              <CorrelativasPanel subject={subject} subjectById={plan.subjectById} />
            ) : (
              <p className="course-quiet">
                {/* Saying "no te falta ninguna" when we never had the graph would be
                asserting an academic fact we do not have. */}
                {correlativasNote(subject, plan.prerequisitesKnown)}
              </p>
            )}
            <UnlocksList unlocks={unlocks} />
          </div>
        </CourseSection>

        {/* Local folder only: the component renders nothing without one. */}
        <SubjectNotes subject={subject} />

        <CourseMaterial
          courseId={courseId}
          resources={resources}
          isLoading={resourcesQuery.isLoading}
          error={(resourcesQuery.error as Error | null) ?? null}
          onRetry={() => void resourcesQuery.refetch()}
        />
      </div>

      <QuickCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        subjects={plan.views}
        items={itemsQuery.data ?? []}
        defaultSubjectId={courseId}
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error ? (createItem.error as Error).message : null}
      />
      {itemActions.dialogs}
      {completion.dialog}
    </div>
  )
}

function CourseHeader({ subject, onAdd }: { subject: SubjectView; onAdd: () => void }) {
  const setStatus = useSetSubjectStatus()
  // Derived statuses (available/blocked/pending) are not stored: the picker reads
  // "Sin marcar", and the meta line says what the plan derived.
  const derived =
    subject.status === 'available' || subject.status === 'blocked'
      ? statusLabel(subject.status)
      : null
  const meta = [
    `${subject.yearLevel}° año`,
    TERM_LABEL[subject.term],
    subject.grade !== null ? `Nota ${subject.grade}` : null,
    derived,
  ].filter(Boolean)

  return (
    <header className="course-head">
      <BackLink />
      <div className="course-head-main">
        <span aria-hidden="true" className="course-glyph">
          <BookOpenText />
        </span>
        <div className="course-head-text">
          <h1 className="course-title">{subject.name}</h1>
          <p className="course-meta">{meta.join(' · ')}</p>
        </div>
        <div className="course-head-actions">
          <Link to="/calendar" className="blue-button-outline course-head-secondary">
            <CalendarDays aria-hidden="true" className="size-4" />
            <span>Calendario</span>
          </Link>
          <Button variant="primary" onClick={onAdd}>
            <Plus aria-hidden="true" />
            Agregar entrega
          </Button>
        </div>
      </div>

      {/* CAP-PLAN-002 — changing this recalculates dependants in the domain. */}
      <StatusPicker
        label="¿Cómo vas?"
        options={STATUS_OPTIONS}
        value={entryValueOf(subject.status)}
        disabled={setStatus.isPending}
        savedMessage={setStatus.isSuccess ? 'Guardado' : null}
        onChange={(status) =>
          setStatus.mutate({
            curriculumSubjectId: subject.id,
            status,
            ...(subject.manual ? { manual: true } : {}),
          })
        }
      />
      <OrderConflictNote subject={subject} dismissible />
      {setStatus.error ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {(setStatus.error as Error).message}
        </p>
      ) : null}
    </header>
  )
}

type RowProps = Omit<Parameters<typeof SubjectDateRow>[0], 'item'>

/** The timeline: what is overdue, then what is ahead, then undated; done ones folded away. */
function CourseDates({
  items,
  now,
  rowProps,
}: {
  items: readonly AcademicItem[]
  now: Date
  rowProps: (item: AcademicItem) => RowProps
}) {
  const timeline = courseTimeline(items, now)
  const open = [...timeline.overdue, ...timeline.upcoming, ...timeline.undated]
  const relativeOf = (item: AcademicItem): string | null => {
    if (timeline.overdue.includes(item)) return 'Atrasada'
    const raw = item.dueAt ?? item.startsAt
    return raw ? relativeDayLabel(calendarDaysUntil(new Date(raw), now)) : null
  }

  return (
    <div className="flex flex-col gap-3">
      {open.length > 0 ? (
        <ol className="course-timeline">
          {open.map((item) => (
            <li key={item.id}>
              <SubjectDateRow
                item={item}
                relative={relativeOf(item)}
                overdue={timeline.overdue.includes(item)}
                {...rowProps(item)}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="course-quiet">No te queda nada pendiente en esta materia.</p>
      )}
      {timeline.finished.length > 0 ? (
        <details className="course-done">
          <summary>
            <ChevronRight aria-hidden="true" className="course-done-chevron size-4" />
            {timeline.finished.length === 1
              ? '1 fecha hecha'
              : `${timeline.finished.length} fechas hechas`}
          </summary>
          <ol className="course-timeline">
            {timeline.finished.map((item) => (
              <li key={item.id}>
                <SubjectDateRow item={item} {...rowProps(item)} />
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}

function BackLink() {
  return (
    <Link to="/courses" className="course-back">
      <ChevronLeft aria-hidden="true" className="size-4" />
      Materias
    </Link>
  )
}
