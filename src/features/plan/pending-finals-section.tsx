import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { EmptyState } from '@/components/empty-state'
import { QuickCapture, type QuickCaptureValues } from '@/components/quick-capture'
import { SubjectRow } from '@/components/subject-row'
import { Button } from '@/components/ui/button'
import { describeItemDate } from '@/domain/item-dates'
import { dependentLine, opensLabel } from '@/domain/pending-finals'
import type { AcademicPlan } from '@/features/academic/queries'
import { dueTimeLabel } from '@/features/items/due'
import { useAcademicItems, useCreateAcademicItem } from '@/features/items/queries'

import { PENDING_FINALS_ID, pendingFinalRows } from './pending-finals-model'

/**
 * "Finales pendientes": every regularizada, the final that habilita the most
 * first. "Agendar final" opens quick capture on a Final for that subject; the
 * correlativas note is a warning, never a block.
 */
export function PendingFinalsSection({
  plan,
}: {
  plan: Pick<AcademicPlan, 'views' | 'prerequisitesKnown'>
}) {
  const itemsQuery = useAcademicItems()
  const createItem = useCreateAcademicItem()
  const [captureFor, setCaptureFor] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const hash = useLocation({ select: (location) => location.hash })

  // Hoy links to `/plan#finales-pendientes`, but the plan renders after its data
  // loads, so the router's own hash scroll finds nothing. Scroll once mounted.
  useEffect(() => {
    if (hash === PENDING_FINALS_ID) sectionRef.current?.scrollIntoView({ block: 'start' })
  }, [hash])

  const items = itemsQuery.data ?? []
  const rows = pendingFinalRows(plan.views, items, new Date())
  const headingId = `${PENDING_FINALS_ID}-titulo`

  function openCapture(subjectId: string) {
    if (createItem.isPending) return
    createItem.reset()
    setCaptureFor(subjectId)
  }

  async function handleCapture(values: QuickCaptureValues) {
    try {
      await createItem.mutateAsync({
        title: values.title,
        kind: values.kind,
        curriculumSubjectId: values.curriculumSubjectId,
        dueAt: values.dueAt,
      })
      setCaptureFor(null)
    } catch {
      /* surfaced through createItem.error, inside the dialog */
    }
  }

  return (
    <section
      id={PENDING_FINALS_ID}
      ref={sectionRef}
      aria-labelledby={headingId}
      className="blue-panel scroll-mt-20"
    >
      <div className="blue-panel-head">
        <h2 id={headingId}>Finales pendientes</h2>
        {rows.length > 0 ? <span className="blue-count">{rows.length}</span> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          quiet
          illustration="courses-finals-empty"
          title="No tenés materias regularizadas con el final pendiente."
          description="Cuando regularices una cursada, aparece acá y te mostramos qué final te conviene rendir primero según las correlativas de tu plan."
        />
      ) : (
        <>
          <p className="text-ink-muted mb-2 text-sm">
            {plan.prerequisitesKnown
              ? 'Tus regularizadas, primero las que más materias te habilitan al aprobar el final.'
              : 'Tus regularizadas, en el orden del plan. Esta facultad no publicó las correlatividades, así que no podemos decirte qué te habilita cada final.'}
          </p>
          <ol className="blue-list">
            {rows.map((row) => {
              const time = row.scheduled ? dueTimeLabel(row.scheduled) : null
              return (
                <li key={row.subject.id} className="pb-2">
                  <SubjectRow
                    subject={row.subject}
                    showYear
                    control={
                      <Button
                        size="sm"
                        aria-label={`Agendar final de ${row.subject.name}`}
                        onClick={() => openCapture(row.subject.id)}
                      >
                        Agendar final
                      </Button>
                    }
                  />
                  <div className="grid gap-1.5 px-3 text-xs sm:pl-10">
                    {plan.prerequisitesKnown ? (
                      row.opens.length > 0 ? (
                        <details className="group">
                          <summary className="text-accent-ink w-fit cursor-pointer py-1 font-medium">
                            {opensLabel(row.opens.length)}
                          </summary>
                          <p className="text-ink-muted mt-1">
                            Lo piden aprobado para rendir el final de:
                          </p>
                          <ul className="text-ink mt-1 grid list-disc gap-0.5 pl-5">
                            {row.opens.map((dependent) => (
                              <li key={dependent.subject.id}>{dependentLine(dependent)}</li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <p className="text-ink-muted">
                          Ninguna materia lo pide aprobado para rendir.
                        </p>
                      )
                    ) : null}
                    {row.scheduled ? (
                      <p className="text-ink">
                        Final agendado: {describeItemDate(row.scheduled)}
                        {time ? `, ${time}` : null}
                      </p>
                    ) : null}
                    {row.warning ? (
                      <p className="text-warning-ink">
                        <span className="font-semibold">Ojo con las correlativas: </span>
                        {row.warning}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </>
      )}

      <QuickCapture
        open={captureFor !== null}
        onOpenChange={(open) => {
          if (!open) setCaptureFor(null)
        }}
        subjects={plan.views}
        items={items}
        defaultSubjectId={captureFor}
        defaultKind="final"
        onSubmit={handleCapture}
        isPending={createItem.isPending}
        error={createItem.error instanceof Error ? createItem.error.message : null}
      />
    </section>
  )
}
