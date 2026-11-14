import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AcademicStatus, StatusGlyph } from '@/components/academic-status'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/field'
import { finalBlockedSentence } from '@/domain/requirements'
import { sortByDate } from '@/domain/item-dates'
import type { StoredSubjectStatus } from '@/domain/types'
import { OrderConflictNote } from '@/features/academic/order-conflict-note'
import { useAcademicPlan, useSetSubjectStatus } from '@/features/academic/queries'
import { AddResourceDialog } from '@/features/courses/add-resource-dialog'
import { CorrelativasPanel, correlativasNote } from '@/features/courses/correlativas-panel'
import { SubjectDateRow } from '@/features/courses/subject-dates'
import { SubjectNotes } from '@/features/courses/subject-notes'
import {
  useAcademicItems,
  useCreateAcademicItem,
  useCreateResource,
  useDeleteResource,
  useResources,
  useToggleAcademicItem,
} from '@/features/items/queries'
import { useItemActions } from '@/features/items/use-item-actions'

export const Route = createFileRoute('/_app/courses/$courseId')({
  component: CourseDetailScreen,
})

const STATUS_OPTIONS: { value: StoredSubjectStatus | ''; label: string }[] = [
  { value: '', label: 'Sin marcar' },
  { value: 'in_progress', label: 'Cursando' },
  { value: 'regularized', label: 'Regularizada' },
  { value: 'passed', label: 'Aprobada' },
  { value: 'failed', label: 'Desaprobada' },
  { value: 'equivalent', label: 'Equivalencia' },
]

const STORED_STATUSES = new Set<string>([
  'in_progress',
  'regularized',
  'passed',
  'failed',
  'equivalent',
])

const TERM_LABEL = { anual: 'Anual', '1c': '1° cuatrimestre', '2c': '2° cuatrimestre' } as const

/** CAP-COURSE-001 — one materia: estado, fechas, material, correlativas. */
function CourseDetailScreen() {
  const { courseId } = Route.useParams()
  const plan = useAcademicPlan()
  const itemsQuery = useAcademicItems()
  const resourcesQuery = useResources()

  const setStatus = useSetSubjectStatus()
  const toggleItem = useToggleAcademicItem()
  const createItem = useCreateAcademicItem()
  const createResource = useCreateResource()
  const deleteResource = useDeleteResource()
  const itemActions = useItemActions({ subjects: plan.views, items: itemsQuery.data ?? [] })

  const [captureOpen, setCaptureOpen] = useState(false)
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false)
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null)

  const subject = plan.subjectById.get(courseId)

  const items = useMemo(
    () => sortByDate((itemsQuery.data ?? []).filter((i) => i.curriculumSubjectId === courseId)),
    [itemsQuery.data, courseId],
  )
  const resources = useMemo(
    () => (resourcesQuery.data ?? []).filter((r) => r.curriculumSubjectId === courseId),
    [resourcesQuery.data, courseId],
  )
  const unlocks = useMemo(
    () => (subject?.unlocks ?? []).map((id) => plan.subjectById.get(id)).filter(Boolean),
    [subject, plan.subjectById],
  )

  if (plan.isLoading) return <LoadingRows rows={6} />
  if (plan.error) return <ErrorState error={plan.error} />

  if (!subject) {
    return (
      <div className="flex flex-col gap-6">
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

  return (
    <div className="blue-screen">
      <BackLink />

      <PageHeader
        eyebrow={`${subject.yearLevel}° año · ${TERM_LABEL[subject.term]}`}
        title={subject.name}
        actions={
          <Button variant="primary" onClick={openCapture}>
            Agregar entrega
          </Button>
        }
      />

      <div className="blue-layout blue-layout-wide">
        <div className="grid min-w-0 gap-5">
          {/* CAP-PLAN-002 — changing this recalculates dependants in the domain. */}
          <section aria-labelledby="estado" className="blue-panel flex flex-col gap-3">
            <SectionHeading id="estado">Tu estado</SectionHeading>
            <div className="flex flex-wrap items-end gap-4">
              <SelectField
                label="¿Cómo vas?"
                className="w-full sm:w-56"
                // Derived statuses (available/blocked/pending) have no stored value,
                // so the select falls back to "Sin marcar".
                value={STORED_STATUSES.has(subject.status) ? subject.status : ''}
                disabled={setStatus.isPending}
                onChange={(e) =>
                  setStatus.mutate({
                    curriculumSubjectId: subject.id,
                    status: (e.target.value || null) as StoredSubjectStatus | null,
                    ...(subject.manual ? { manual: true } : {}),
                  })
                }
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
              <div className="flex flex-col gap-0.5 pb-2.5">
                <p>
                  <AcademicStatus status={subject.status} />
                </p>
                {finalBlockedSentence(subject) ? (
                  <p className="text-ink-muted text-sm">{finalBlockedSentence(subject)}</p>
                ) : null}
              </div>
            </div>
            <OrderConflictNote subject={subject} dismissible />
            {setStatus.error ? (
              <p role="alert" className="text-danger text-sm font-medium">
                {(setStatus.error as Error).message}
              </p>
            ) : null}
            <MutationAlert error={toggleItem.error ?? deleteResource.error} />
          </section>

          <section aria-labelledby="fechas" className="blue-panel flex flex-col gap-2">
            <SectionHeading id="fechas">Fechas</SectionHeading>
            {/* A failed fetch is not an empty list: telling the student "no tenés nada"
            here makes them re-add an entrega they already had. */}
            {itemsQuery.error ? (
              <ErrorState
                className="mt-2"
                title="No pudimos cargar tus fechas"
                error={itemsQuery.error as Error}
                onRetry={() => void itemsQuery.refetch()}
              />
            ) : itemsQuery.isLoading ? (
              <LoadingRows rows={2} />
            ) : items.length === 0 ? (
              <EmptyState
                quiet
                illustration="course-tasks-empty"
                title="No tenés nada anotado para esta materia."
                action={
                  <Button variant="secondary" onClick={openCapture}>
                    Anotar la primera fecha
                  </Button>
                }
              />
            ) : (
              <div>
                {items.map((item) => (
                  <SubjectDateRow
                    key={item.id}
                    item={item}
                    onToggle={(done) => toggleItem.mutate({ id: item.id, done })}
                    onShare={() => void itemActions.share(item)}
                    onDownloadIcs={() => itemActions.downloadIcs(item)}
                    onEdit={() => itemActions.edit(item)}
                    onDelete={() => itemActions.remove(item)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Local folder only: the component renders nothing without one. */}
          <div className="blue-panel empty:hidden">
            <SubjectNotes subject={subject} />
          </div>

          <section aria-labelledby="correlativas" className="blue-panel flex flex-col gap-3">
            <SectionHeading id="correlativas">Correlativas</SectionHeading>

            {subject.requirements.length > 0 ? (
              <CorrelativasPanel subject={subject} />
            ) : (
              <p className="text-ink-muted text-sm">
                {/* Saying "no te falta ninguna" when we never had the graph would be
                asserting an academic fact we do not have. */}
                {correlativasNote(subject, plan.prerequisitesKnown)}
              </p>
            )}

            {unlocks.length > 0 ? (
              <div className="flex flex-col gap-1.5 pt-2">
                <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
                  Habilita
                </p>
                <ul className="flex flex-col gap-1">
                  {unlocks.map((target) => (
                    <li key={target!.id} className="flex items-center gap-2">
                      <StatusGlyph status={target!.status} />
                      <Link
                        to="/courses/$courseId"
                        params={{ courseId: target!.id }}
                        className="text-ink text-sm underline-offset-4 hover:underline"
                      >
                        {target!.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section aria-labelledby="material" className="blue-panel flex flex-col gap-3">
            <SectionHeading id="material">Material</SectionHeading>

            {resourcesQuery.isLoading ? (
              <LoadingRows rows={2} />
            ) : resourcesQuery.error ? (
              <ErrorState
                title="No pudimos cargar tu material"
                error={resourcesQuery.error as Error}
                onRetry={() => void resourcesQuery.refetch()}
              />
            ) : null}

            {resources.length > 0 ? (
              <ul>
                {resources.map((resource) => (
                  <li
                    key={resource.id}
                    className="border-rule-soft flex items-center gap-3 border-b py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      {resource.kind === 'link' && resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-ink inline-flex max-w-full items-center gap-2 text-sm underline-offset-4 hover:underline"
                        >
                          <span className="truncate">{resource.title}</span>
                          <ExternalLink
                            aria-hidden="true"
                            className="text-ink-faint size-3.5 shrink-0"
                          />
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="text-ink text-left text-sm font-medium underline-offset-4 hover:underline"
                          aria-expanded={expandedResourceId === resource.id}
                          onClick={() =>
                            setExpandedResourceId((id) =>
                              id === resource.id ? null : resource.id,
                            )
                          }
                        >
                          {resource.title} ·{' '}
                          {expandedResourceId === resource.id ? 'Ocultar nota' : 'Leer nota'}
                        </button>
                      )}
                      {resource.kind === 'note' && expandedResourceId === resource.id ? (
                        <p className="text-ink-muted mt-2 text-sm break-words whitespace-pre-wrap">
                          {resource.body || 'Nota vacía.'}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-touch"
                      disabled={deleteResource.isPending}
                      aria-label={`Borrar ${resource.title}`}
                      onClick={() => deleteResource.mutate(resource.id)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {resources.length === 0 && !resourcesQuery.isLoading && !resourcesQuery.error ? (
              <p className="text-ink-muted text-sm">
                Todavía no guardaste material de esta materia.
              </p>
            ) : null}

            <Button
              variant="secondary"
              className="self-start"
              onClick={() => {
                createResource.reset()
                setResourceDialogOpen(true)
              }}
            >
              <Plus aria-hidden="true" />
              Agregar material
            </Button>
            <AddResourceDialog
              open={resourceDialogOpen}
              onClose={() => setResourceDialogOpen(false)}
              onSave={(resource) =>
                createResource.mutateAsync({ ...resource, curriculumSubjectId: courseId })
              }
              saving={createResource.isPending}
              error={createResource.error}
            />
          </section>
        </div>

        <aside aria-label="Resumen de la materia" className="grid min-w-0 content-start gap-4">
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Estado académico</h2>
            </div>
            <div className="mb-3">
              <span className="blue-chip" data-status={subject.status}>
                <AcademicStatus status={subject.status} />
              </span>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="blue-stat-row">
                <dt className="text-ink-muted">Año</dt>
                <dd className="ml-auto font-medium">{subject.yearLevel}°</dd>
              </div>
              <div className="blue-stat-row">
                <dt className="text-ink-muted">Régimen</dt>
                <dd className="ml-auto font-medium">{TERM_LABEL[subject.term]}</dd>
              </div>
              {subject.grade !== null ? (
                <div className="blue-stat-row">
                  <dt className="text-ink-muted">Nota</dt>
                  <dd className="ml-auto font-medium">{subject.grade}</dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Próximos pasos</h2>
            </div>
            <p className="text-ink-muted mb-3 text-sm">
              {items.length} {items.length === 1 ? 'fecha registrada' : 'fechas registradas'}{' '}
              para esta materia.
            </p>
            <Button variant="primary" onClick={openCapture} className="w-full">
              Agregar entrega
            </Button>
            <Link to="/calendar" className="blue-text-link mt-3 inline-flex">
              Abrir calendario
              <ArrowRight aria-hidden="true" />
            </Link>
          </section>
          <section className="blue-panel">
            <div className="blue-panel-head">
              <h2>Material</h2>
            </div>
            <p className="text-ink-muted text-sm">
              {resources.length}{' '}
              {resources.length === 1 ? 'recurso guardado' : 'recursos guardados'}
            </p>
            <Link to="/library" className="blue-text-link mt-3 inline-flex">
              Ver biblioteca
              <ArrowRight aria-hidden="true" />
            </Link>
          </section>
        </aside>
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
    </div>
  )
}

/**
 * A failed mutation with no optimistic update leaves the control exactly as it was.
 * Without this the student cannot tell a no-op from a failure, and taps again.
 */
function MutationAlert({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" aria-live="polite" className="text-danger text-sm font-medium">
      {(error as Error).message}
    </p>
  )
}

function BackLink() {
  return (
    <Link
      to="/courses"
      className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Materias
    </Link>
  )
}
