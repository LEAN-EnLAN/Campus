import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink, FileText, Link2, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useAcademicPlan } from '@/features/academic/queries'
import { AddResourceDialog } from '@/features/courses/add-resource-dialog'
import { useCreateResource, useDeleteResource, useResources } from '@/features/items/queries'

export const Route = createFileRoute('/_app/library')({
  component: LibraryScreen,
})

/**
 * CAP-RESOURCE-001 — links and notes. No upload until validation is proven.
 * Adding goes through the same dialog as a subject's page, plus a subject choice.
 */
function LibraryScreen() {
  const plan = useAcademicPlan()
  const resourcesQuery = useResources()
  const createResource = useCreateResource()
  const deleteResource = useDeleteResource()

  const [dialogOpen, setDialogOpen] = useState(false)
  // Kept between openings: consecutive material usually goes to the same subject.
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'link' | 'note'>('all')
  const [filterSubject, setFilterSubject] = useState('all')

  const resources = resourcesQuery.data ?? []
  const filtered = useMemo(
    () =>
      resources.filter(
        (resource) =>
          (filterKind === 'all' || resource.kind === filterKind) &&
          (filterSubject === 'all' || (resource.curriculumSubjectId ?? '') === filterSubject) &&
          [resource.title, resource.body ?? '', resource.url ?? ''].some((value) =>
            value.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')),
          ),
      ),
    [resources, filterKind, filterSubject, search],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, typeof resources>()
    for (const resource of filtered) {
      const key = resource.curriculumSubjectId ?? ''
      const bucket = map.get(key)
      if (bucket) bucket.push(resource)
      else map.set(key, [resource])
    }
    return [...map.entries()].map(([id, list]) => ({
      id,
      name: id ? (plan.subjectById.get(id)?.name ?? 'Materia desconocida') : 'Sin materia',
      list,
    }))
  }, [filtered, plan.subjectById])

  function openDialog() {
    createResource.reset()
    setDialogOpen(true)
  }

  return (
    <div className="blue-screen blue-secondary">
      <PageHeader
        title="Material"
        description="Tus links y notas, organizados por materia."
        actions={
          <Button variant="primary" onClick={openDialog}>
            <Plus aria-hidden="true" className="size-4" />
            Agregar material
          </Button>
        }
      />
      <div className="blue-secondary-summary" aria-label="Resumen de material">
        <div>
          <span>Guardados</span>
          <strong>{resources.length}</strong>
        </div>
        <div>
          <span>Links</span>
          <strong>{resources.filter((resource) => resource.kind === 'link').length}</strong>
        </div>
        <div>
          <span>Notas</span>
          <strong>{resources.filter((resource) => resource.kind === 'note').length}</strong>
        </div>
      </div>

      <AddResourceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(resource) =>
          createResource.mutateAsync({ ...resource, curriculumSubjectId: subjectId })
        }
        saving={createResource.isPending}
        error={createResource.error}
        subjectChoice={{ subjects: plan.views, value: subjectId, onChange: setSubjectId }}
      />

      <section className="blue-secondary-panel" aria-label="Material guardado">
        <div className="blue-secondary-panel-title">
          <h2>
            Biblioteca <span className="blue-count">{resources.length}</span>
          </h2>
          <span>Links y notas</span>
        </div>
        <div className="blue-secondary-toolbar">
          <label className="blue-secondary-search">
            <Search aria-hidden="true" className="size-4" />
            <span className="sr-only">Buscar material</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar material…"
            />
          </label>
          <label className="blue-secondary-filter">
            <span>Tipo</span>
            <select
              value={filterKind}
              onChange={(event) => setFilterKind(event.target.value as 'all' | 'link' | 'note')}
            >
              <option value="all">Todos</option>
              <option value="link">Links</option>
              <option value="note">Notas</option>
            </select>
          </label>
          <label className="blue-secondary-filter">
            <span>Materia</span>
            <select
              value={filterSubject}
              onChange={(event) => setFilterSubject(event.target.value)}
            >
              <option value="all">Todas</option>
              <option value="">Sin materia</option>
              {plan.views.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {deleteResource.error ? (
          <p role="alert" aria-live="polite" className="text-danger text-sm font-medium">
            {(deleteResource.error as Error).message}
          </p>
        ) : null}

        {resourcesQuery.error ? (
          <ErrorState
            error={resourcesQuery.error as Error}
            onRetry={() => void resourcesQuery.refetch()}
          />
        ) : null}

        {resourcesQuery.isLoading ? (
          <LoadingRows rows={4} />
        ) : resources.length === 0 ? (
          <EmptyState
            illustration="material-empty"
            title="Todavía no guardaste nada"
            description="Guardá el link al drive de la cátedra o esa nota que siempre buscás antes del parcial."
            action={
              <Button variant="primary" onClick={openDialog}>
                Agregar material
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No hay resultados"
            description="Probá otra búsqueda o cambiá los filtros."
            quiet
            action={
              <Button
                onClick={() => {
                  setSearch('')
                  setFilterKind('all')
                  setFilterSubject('all')
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          grouped.map((group) => (
            <section
              key={group.id || 'none'}
              className="blue-secondary-group flex flex-col gap-1"
            >
              <SectionHeading aside={`${group.list.length}`}>
                {group.id ? (
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: group.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {group.name}
                  </Link>
                ) : (
                  group.name
                )}
              </SectionHeading>

              <ul className="blue-secondary-resource-list">
                {group.list.map((resource) => (
                  <li
                    key={resource.id}
                    className="blue-secondary-resource border-rule-soft flex items-start gap-3 border-b py-3"
                  >
                    <span className="blue-secondary-resource-icon">
                      {resource.kind === 'link' ? (
                        <Link2 aria-hidden="true" />
                      ) : (
                        <FileText aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      {resource.kind === 'link' && resource.url ? (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-ink flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
                        >
                          <span className="truncate">{resource.title}</span>
                          <ExternalLink
                            aria-hidden="true"
                            className="text-ink-faint size-3.5 shrink-0"
                          />
                        </a>
                      ) : (
                        <>
                          <span className="text-ink block text-sm">{resource.title}</span>
                          {resource.body ? (
                            <span className="text-ink-muted mt-0.5 block text-xs whitespace-pre-line">
                              {resource.body}
                            </span>
                          ) : null}
                        </>
                      )}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon-touch"
                      aria-label={`Borrar ${resource.title}`}
                      disabled={deleteResource.isPending}
                      onClick={() => deleteResource.mutate(resource.id)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  )
}
