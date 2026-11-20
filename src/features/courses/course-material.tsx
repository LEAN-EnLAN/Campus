import { Link } from '@tanstack/react-router'
import { ExternalLink, Library, Plus, StickyNote, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import type { Resource } from '@/domain/types'
import { AddResourceDialog } from '@/features/courses/add-resource-dialog'
import { CourseSection } from '@/features/courses/course-section'
import { MaterialFileLink } from '@/features/courses/material-file-link'
import { useCanUploadMaterialFiles } from '@/features/courses/use-material-files'
import { useCreateResource, useDeleteResource } from '@/features/items/queries'

/**
 * "Material" of one materia: the only place on the page that lists it, with
 * its own add button. Links open in a new tab, files through a signed link,
 * notes unfold in place.
 */
export function CourseMaterial({
  courseId,
  resources,
  isLoading,
  error,
  onRetry,
}: {
  courseId: string
  /** This subject's resources only. */
  resources: readonly Resource[]
  isLoading: boolean
  error: Error | null
  onRetry: () => void
}) {
  const canUploadFiles = useCanUploadMaterialFiles()
  const createResource = useCreateResource()
  const deleteResource = useDeleteResource()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function openDialog() {
    createResource.reset()
    setDialogOpen(true)
  }

  const addButton = (
    <Button variant="secondary" size="sm" onClick={openDialog}>
      <Plus aria-hidden="true" />
      Agregar material
    </Button>
  )
  const empty = resources.length === 0 && !isLoading && !error

  return (
    <CourseSection
      id="material"
      icon={<Library />}
      title="Material"
      purpose={
        <>
          Apuntes, links y archivos de esta materia.{' '}
          <Link to="/library" className="course-inline-link">
            Ver toda tu biblioteca
          </Link>
        </>
      }
      action={empty ? undefined : addButton}
    >
      {isLoading ? <LoadingRows rows={2} /> : null}
      {error ? (
        <ErrorState title="No pudimos cargar tu material" error={error} onRetry={onRetry} />
      ) : null}

      {resources.length > 0 ? (
        <ul className="course-rows">
          {resources.map((resource) => (
            <li key={resource.id} className="course-row items-start">
              <div className="min-w-0 flex-1">
                {resource.kind === 'file' ? (
                  <MaterialFileLink resource={resource} />
                ) : resource.kind === 'link' && resource.url ? (
                  <span className="flex min-w-0 flex-col">
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-ink inline-flex max-w-full items-center gap-2 text-sm underline-offset-4 hover:underline"
                    >
                      <ExternalLink
                        aria-hidden="true"
                        className="text-ink-faint size-3.5 shrink-0"
                      />
                      <span className="truncate">{resource.title}</span>
                    </a>
                    <span className="text-ink-muted text-xs">Link</span>
                  </span>
                ) : (
                  <span className="flex min-w-0 flex-col">
                    <button
                      type="button"
                      className="text-ink inline-flex items-center gap-2 text-left text-sm underline-offset-4 hover:underline"
                      aria-expanded={expandedId === resource.id}
                      onClick={() =>
                        setExpandedId((id) => (id === resource.id ? null : resource.id))
                      }
                    >
                      <StickyNote
                        aria-hidden="true"
                        className="text-ink-faint size-3.5 shrink-0"
                      />
                      {resource.title} ·{' '}
                      {expandedId === resource.id ? 'Ocultar nota' : 'Leer nota'}
                    </button>
                    <span className="text-ink-muted text-xs">Nota</span>
                  </span>
                )}
                {resource.kind === 'note' && expandedId === resource.id ? (
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
                className="hover:text-danger -my-2"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {empty ? (
        <EmptyState
          quiet
          className="[&_img]:max-w-36"
          illustration="material-empty"
          title="Todavía no guardaste material de esta materia."
          action={addButton}
        />
      ) : null}

      {/* A failed delete leaves the row exactly as it was; without this the
      student cannot tell a no-op from a failure, and taps again. */}
      {deleteResource.error ? (
        <p role="alert" aria-live="polite" className="text-danger mt-2 text-sm font-medium">
          {(deleteResource.error as Error).message}
        </p>
      ) : null}

      <AddResourceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(resource) =>
          createResource.mutateAsync({ ...resource, curriculumSubjectId: courseId })
        }
        canUploadFiles={canUploadFiles}
        saving={createResource.isPending}
        error={createResource.error}
      />
    </CourseSection>
  )
}
