import { createFileRoute, Link } from '@tanstack/react-router'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState, ErrorState, LoadingRows } from '@/components/empty-state'
import { PageHeader, SectionHeading } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { SelectField, TextField, TextareaField } from '@/components/ui/field'
import { useAcademicPlan } from '@/features/academic/queries'
import { useCreateResource, useDeleteResource, useResources } from '@/features/items/queries'

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

  const resources = resourcesQuery.data ?? []

  const grouped = useMemo(() => {
    const map = new Map<string, typeof resources>()
    for (const resource of resources) {
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
  }, [resources, plan.subjectById])

  const canSubmit =
    title.trim().length > 0 &&
    (kind === 'link' ? url.trim().length > 0 : body.trim().length > 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
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
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Tu material"
        description="Links y notas cortas, guardados donde los vas a buscar."
      />

      <section
        aria-labelledby="agregar-material"
        className="border-rule bg-paper-elevated flex flex-col gap-4 rounded-lg border p-4 sm:p-5"
      >
        <SectionHeading id="agregar-material">Agregar</SectionHeading>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            label="Título"
            placeholder={kind === 'link' ? 'Apunte de la cátedra' : 'Fórmulas de la unidad 3'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {kind === 'link' ? (
            <TextField
              label="Link"
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          ) : (
            <TextareaField
              label="Nota"
              placeholder="Escribí lo que no querés olvidarte."
              value={body}
              onChange={(e) => setBody(e.target.value)}
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
            disabled={!canSubmit || createResource.isPending}
          >
            {createResource.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </section>

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
          title="Todavía no guardaste nada"
          description="Guardá el link al drive de la cátedra o esa nota que siempre buscás antes del parcial."
        />
      ) : (
        grouped.map((group) => (
          <section key={group.id || 'none'} className="flex flex-col gap-1">
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

            <ul>
              {group.list.map((resource) => (
                <li
                  key={resource.id}
                  className="border-rule-soft flex items-start gap-3 border-b py-3"
                >
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
                    size="icon"
                    aria-label={`Borrar ${resource.title}`}
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
    </div>
  )
}
