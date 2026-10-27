import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink, FileText, Link2, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { SelectField, TextField, TextareaField } from '@/components/ui/field'
import { useAcademicPlan } from '@/features/academic/queries'
import { useCreateResource, useDeleteResource, useResources } from '@/features/items/queries'
import '@/styles/blue-secondary.css'

export const Route = createFileRoute('/_app/library')({
  component: LibraryScreen,
})

/** CAP-RESOURCE-001 — links and notes. No upload until validation is proven. */
function LibraryScreen() {
  const plan = useAcademicPlan()
  const resourcesQuery = useResources()
  const createResource = useCreateResource()
  const deleteResource = useDeleteResource()

  const [kind, setKind] = useState<'link' | 'note'>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [body, setBody] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'link' | 'note'>('all')
  const [filterSubject, setFilterSubject] = useState('all')
  const titleRef = useRef<HTMLInputElement>(null)

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

  // Our own checks and our own words: the form opts out of the browser's
  // (`noValidate`), and Guardar is never silently disabled — it says what is missing.
  const titleError = title.trim().length === 0 ? 'Poné un título.' : null
  const linkError =
    kind !== 'link'
      ? null
      : url.trim().length === 0
        ? 'Pegá el link.'
        : !/^https?:\/\/\S+$/i.test(url.trim())
          ? 'El link tiene que empezar con http:// o https://.'
          : null
  const bodyError = kind === 'note' && body.trim().length === 0 ? 'Escribí la nota.' : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (titleError || linkError || bodyError) return
    try {
      await createResource.mutateAsync({
        title,
        kind,
        curriculumSubjectId: subjectId || null,
        url: kind === 'link' ? url.trim() : null,
        body: kind === 'note' ? body.trim() : null,
      })
      setTitle('')
      setUrl('')
      setBody('')
      setSubmitted(false)
      setShowForm(false)
      // Ready for the next one: focus used to stay in the (now empty) last field.
      titleRef.current?.focus()
    } catch {
      // Preserve user input and expose the mutation error in the form.
    }
  }

  return (
    <div className="blue-screen blue-secondary">
      <PageHeader
        title="Material"
        description="Tus links y notas, organizados por materia."
        actions={
          <Button variant="primary" onClick={() => setShowForm((value) => !value)}>
            <Plus aria-hidden="true" className="size-4" />
            {showForm ? 'Cerrar formulario' : 'Agregar material'}
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

      {showForm ? (
        <section
          aria-labelledby="agregar-material"
          className="blue-secondary-panel flex flex-col gap-4"
        >
          <SectionHeading id="agregar-material">Agregar</SectionHeading>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Tipo"
                value={kind}
                onChange={(e) => setKind(e.target.value as 'link' | 'note')}
              >
                <option value="link">Link</option>
                <option value="note">Nota</option>
              </SelectField>

              <SelectField
                label="Materia"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="">Sin materia</option>
                {plan.views.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextField
              ref={titleRef}
              label="Título"
              placeholder={kind === 'link' ? 'Apunte de la cátedra' : 'Fórmulas de la unidad 3'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={submitted ? titleError : null}
              required
            />

            {kind === 'link' ? (
              <TextField
                label="Link"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                error={submitted ? linkError : null}
                required
              />
            ) : (
              <TextareaField
                label="Nota"
                placeholder="Escribí lo que no querés olvidarte."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                error={submitted ? bodyError : null}
                required
              />
            )}

            {createResource.error ? (
              <p role="alert" className="text-danger text-sm font-medium">
                {(createResource.error as Error).message}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              className="self-start"
              disabled={createResource.isPending}
            >
              {createResource.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </form>
        </section>
      ) : null}

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
            illustration="/campus-blue-assets/material-empty.svg"
            title="Todavía no guardaste nada"
            description="Guardá el link al drive de la cátedra o esa nota que siempre buscás antes del parcial."
            action={
              <Button variant="primary" onClick={() => setShowForm(true)}>
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
