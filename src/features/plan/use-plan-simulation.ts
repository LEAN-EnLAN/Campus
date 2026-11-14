import { useState } from 'react'

import { groupByYear } from '@/domain/availability'
import { entryValueOf } from '@/domain/progress-entry'
import { simulateViews, simulationDiff } from '@/domain/simulation'
import type { StoredSubjectStatus, SubjectView } from '@/domain/types'
import type { AcademicPlan } from '@/features/academic/queries'

export interface SimulatedChange {
  subject: SubjectView
  to: StoredSubjectStatus | null
}

/**
 * The simulator's state: imagined statuses, in memory only.
 *
 * Nothing here reaches a mutation or the backend. Leaving the simulation
 * unmounts this state, so the real plan is what comes back.
 */
export function usePlanSimulation(plan: Pick<AcademicPlan, 'views' | 'availabilityInput'>) {
  const [hypotheses, setHypotheses] = useState<ReadonlyMap<string, StoredSubjectStatus | null>>(
    () => new Map(),
  )

  const views = plan.availabilityInput
    ? simulateViews(plan.availabilityInput, hypotheses)
    : plan.views
  const byId = new Map(views.map((v) => [v.id, v]))
  const realById = new Map(plan.views.map((v) => [v.id, v]))

  function imagine(subjectId: string, status: StoredSubjectStatus | null) {
    setHypotheses((previous) => {
      const next = new Map(previous)
      const real = realById.get(subjectId)
      // Back to what is really stored: not a hypothesis any more.
      if (real && entryValueOf(real.status) === status) next.delete(subjectId)
      else next.set(subjectId, status)
      return next
    })
  }

  const changes: SimulatedChange[] = []
  for (const [id, to] of hypotheses) {
    const subject = byId.get(id)
    if (subject) changes.push({ subject, to })
  }

  return {
    views,
    byYear: groupByYear(views),
    diff: simulationDiff(plan.views, views),
    changes,
    imagine,
    reset: () => setHypotheses(new Map()),
  }
}
