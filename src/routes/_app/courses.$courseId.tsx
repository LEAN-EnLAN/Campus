import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { AcademicStatus, StatusGlyph } from '@/components/academic-status'
import { DeadlineRow } from '@/components/deadline-row'
import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { Button } from '@/components/ui/button'
import { SelectField, TextField } from '@/components/ui/field'
import type { StoredSubjectStatus } from '@/domain/types'
import { useAcademicPlan, useSetSubjectStatus } from '@/features/academic/queries'
import {
  useAcademicItems,
  useCreateAcademicItem,
  useCreateResource,
  useDeleteResource,
  useResources,
  useToggleAcademicItem,
} from '@/features/items/queries'

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

  const [captureOpen, setCaptureOpen] = useState(false)
  const [resourceTitle, setResourceTitle] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')

  const subject = plan.subjectById.get(courseId)

  const items = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.curriculumSubjectId === courseId),
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

  async function handleAddResource(event: React.FormEvent) {
    event.preventDefault()
    if (!resourceTitle.trim() || !resourceUrl.trim()) return
    await createResource.mutateAsync({
      title: resourceTitle,
      kind: 'link',
      curriculumSubjectId: courseId,
      url: resourceUrl.trim(),
      body: null,
    })
    setResourceTitle('')
    setResourceUrl('')
  }

  return (
    <div className="flex flex-col gap-8">
      <BackLink />

      <PageHeader
        eyebrow={`${subject.yearLevel}° año · ${TERM_LABEL[subject.term]}`}
        title={subject.name}
        actions={
          <Button variant="primary" onClick={() => setCaptureOpen(true)}>
            Agregar entrega
          </Button>
        }
      />

      {/* CAP-PLAN-002 — changing this recalculates dependants in the domain. */}
      <section aria-labelledby="estado" className="flex flex-col gap-3">
        <SectionHeading id="estado">Tu estado</SectionHeading>
        <div className="flex flex-wrap items-end gap-4">
          <SelectField
            label="¿Cómo vas?"
            className="w-56"
            // Derived statuses (available/blocked/pending) have no stored value,
            // so the select falls back to "Sin marcar".
            value={STORED_STATUSES.has(subject.status) ? subject.status : ''}
            disabled={setStatus.isPending}
            onChange={(e) =>
              setStatus.mutate({
                curriculumSubjectId: subject.id,
                status: (e.target.value || null) as StoredSubjectStatus | null,
              })
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <p className="pb-2.5">
            <AcademicStatus status={subject.status} />
          </p>
        </div>
        {setStatus.error ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {(setStatus.error as Error).message}
          </p>
        ) : null}
        <MutationAlert error={toggleItem.error ?? deleteResource.error} />
      </section>

      <section aria-labelledby="fechas" className="flex flex-col gap-1">
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
        ) : items.length === 0 ? (
          <p className="text-ink-muted py-3 text-sm">
            No tenés nada anotado para esta materia.
          </p>
        ) : (
          <div>
            {items.map((item) => (
              <DeadlineRow
                key={item.id}
                item={item}
                onToggle={(done) => toggleItem.mutate({ id: item.id, done })}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="correlativas" className="flex flex-col gap-3">
        <SectionHeading id="correlativas">Correlativas</SectionHeading>

        {subject.missingRequirements.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
              Te falta
            </p>
            <ul className="flex flex-col gap-1">
              {subject.missingRequirements.map((requirement) => (
                <li key={`${requirement.curriculumSubjectId}-${requirement.kind}`}>
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: requirement.curriculumSubjectId }}
                    className="text-ink text-sm underline-offset-4 hover:underline"
                  >
                    {requirement.name}
                  </Link>
                  <span className="text-ink-muted text-sm"> — {requirement.needs}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-ink-muted text-sm">
            {/* Saying "no te falta ninguna" when we never had the graph would be
                asserting an academic fact we do not have. */}
            {plan.prerequisiteCount === 0
              ? 'Esta facultad todavía no publicó las correlatividades de este plan. No sabemos qué te piden para cursarla, y no lo vamos a inventar.'
              : 'No te falta ninguna correlativa para cursar esta materia.'}
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

      <section aria-labelledby="material" className="flex flex-col gap-3">
        <SectionHeading id="material">Material</SectionHeading>

        {resourcesQuery.error ? (
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
                <a
                  href={resource.url ?? '#'}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-ink flex min-w-0 flex-1 items-center gap-2 text-sm underline-offset-4 hover:underline"
                >
                  <span className="truncate">{resource.title}</span>
                  <ExternalLink
                    aria-hidden="true"
                    className="text-ink-faint size-3.5 shrink-0"
                  />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Borrar ${resource.title}`}
                  onClick={() => deleteResource.mutate(resource.id)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <form
          onSubmit={handleAddResource}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <TextField
            label="Título"
            placeholder="Apunte de la cátedra"
            value={resourceTitle}
            onChange={(e) => setResourceTitle(e.target.value)}
            className="sm:w-56"
          />
          <TextField
            label="Link"
            type="url"
            placeholder="https://…"
            value={resourceUrl}
            onChange={(e) => setResourceUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={createResource.isPending || !resourceTitle.trim() || !resourceUrl.trim()}
          >
            Guardar
          </Button>
        </form>
      </section>

      <QuickCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        subjects={plan.views}
        defaultSubjectId={courseId}
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error ? (createItem.error as Error).message : null}
      />
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
