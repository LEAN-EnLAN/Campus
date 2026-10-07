import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import type {
  AcademicContext,
  CurriculumSubject,
  ManualSubject,
  UserSubjectState,
} from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import { applyManualBatch, applyStatusBatch, unknownManualIds } from '@/lib/backends/normalize'
import type { CampusBackend } from '@/lib/backends/types'

import {
  useAcademicPlan,
  useAddManualSubject,
  useSetSubjectStatus,
  useSetSubjectStatuses,
} from './queries'

const subjectOf = (id: string, over: Partial<CurriculumSubject> = {}): CurriculumSubject => ({
  id,
  curriculumId: 'c',
  subjectId: id,
  code: null,
  name: id,
  normalizedName: id,
  yearLevel: 1,
  term: 'anual',
  credits: null,
  elective: false,
  displayOrder: 1,
  ...over,
})

const context = (over: Partial<AcademicContext> = {}): AcademicContext => ({
  id: 'ctx',
  institutionId: null,
  academicUnitId: null,
  programId: null,
  curriculumId: 'plan-1',
  unmappedLabel: null,
  isActive: true,
  ...over,
})

interface Store {
  context: AcademicContext | null
  states: UserSubjectState[]
  manual: ManualSubject[]
  subjects: CurriculumSubject[]
  failWrites?: boolean
}

/** Just enough backend for the hooks: an in-memory store behind the real seam shape. */
function fakeBackend(store: Store, delayMs = 0) {
  const wait = () => new Promise((r) => setTimeout(r, delayMs))
  const calls: string[] = []
  const backend = {
    kind: 'local',
    catalog: {
      curriculumBundle: async () => ({
        curriculum: null,
        programName: 'Carrera',
        subjects: store.subjects,
        prerequisites: [],
        prerequisitesKnown: true,
        prerequisitesNote: null,
      }),
    },
    academic: {
      context: async () => store.context,
      subjectStates: async () => store.states,
      manualSubjects: async () => store.manual,
      setSubjectStatus: async (input: never) => backend.academic.setSubjectStatuses([input]),
      setSubjectStatuses: async (inputs: Parameters<typeof applyStatusBatch>[1]) => {
        calls.push(`start:${inputs.map((i) => i.curriculumSubjectId).join(',')}`)
        await wait()
        if (store.failWrites) throw new Error('forced write failure')
        if (inputs[0]?.manual) store.manual = applyManualBatch(store.manual, inputs)
        else store.states = applyStatusBatch(store.states, inputs, new Date())
        calls.push(`end:${inputs.map((i) => i.curriculumSubjectId).join(',')}`)
      },
      addManualSubject: async (input: { name: string; yearLevel: number; term: never }) => {
        const added: ManualSubject = {
          id: `m${store.manual.length + 1}`,
          status: null,
          grade: null,
          ...input,
        }
        store.manual = [...store.manual, added]
        return added
      },
    },
  } as unknown as CampusBackend
  return { backend, calls }
}

function setup(store: Store, delayMs = 0) {
  const { backend, calls } = fakeBackend(store, delayMs)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <BackendProvider backend={backend}>{children}</BackendProvider>
    </QueryClientProvider>
  )
  return { wrapper, calls, client }
}

describe('useAcademicPlan with a manual career', () => {
  const unmapped = (manual: ManualSubject[]): Store => ({
    context: context({ curriculumId: null, unmappedLabel: 'Mi carrera' }),
    states: [],
    manual,
    subjects: [],
  })

  it('shows the subjects the student typed in, never available or blocked', async () => {
    const store = unmapped([
      { id: 'm1', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
      {
        id: 'm2',
        name: 'Física',
        yearLevel: 2,
        term: 'anual',
        status: 'in_progress',
        grade: null,
      },
    ])
    const { wrapper } = setup(store)
    const { result } = renderHook(() => useAcademicPlan(), { wrapper })
    await waitFor(() => expect(result.current.views).toHaveLength(2))

    expect(result.current.isUnmapped).toBe(true)
    expect(result.current.prerequisitesKnown).toBe(false)
    expect(result.current.views.map((v) => [v.name, v.status, v.manual])).toEqual([
      ['Cálculo', 'pending', true],
      ['Física', 'in_progress', true],
    ])
    expect(result.current.progress.available).toBe(0)
    expect(result.current.progress.blocked).toBe(0)
    expect(result.current.byYear.map((g) => g.yearLevel)).toEqual([1, 2])
  })

  it('ignores manual subjects once the student has a real plan', async () => {
    const store: Store = {
      context: context(),
      states: [],
      manual: [
        { id: 'm1', name: 'Vieja', yearLevel: 1, term: '1c', status: null, grade: null },
      ],
      subjects: [subjectOf('real')],
    }
    const { wrapper } = setup(store)
    const { result } = renderHook(() => useAcademicPlan(), { wrapper })
    await waitFor(() => expect(result.current.views).toHaveLength(1))
    expect(result.current.views[0]!.id).toBe('real')
  })
})

describe('setting statuses', () => {
  const planStore = (): Store => ({
    context: context(),
    states: [],
    manual: [],
    subjects: ['a', 'b', 'c', 'd'].map((id) => subjectOf(id)),
  })

  it('shows the new status at once, before the write finishes', async () => {
    const { wrapper } = setup(planStore(), 300)
    const { result } = renderHook(
      () => ({ plan: useAcademicPlan(), set: useSetSubjectStatus() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.plan.views).toHaveLength(4))

    act(() => {
      result.current.set.mutate({ curriculumSubjectId: 'a', status: 'passed' })
    })
    await waitFor(() =>
      expect(result.current.plan.views.find((v) => v.id === 'a')?.status).toBe('passed'),
    )
    expect(result.current.set.isPending).toBe(true)
    await waitFor(() => expect(result.current.set.isPending).toBe(false))
  })

  it('runs rapid clicks one after another, so the vault never sees two writers', async () => {
    const { wrapper, calls } = setup(planStore(), 10)
    const { result } = renderHook(() => useSetSubjectStatus(), { wrapper })

    await act(async () => {
      await Promise.all(
        ['a', 'b', 'c'].map((id) =>
          result.current.mutateAsync({ curriculumSubjectId: id, status: 'passed' }),
        ),
      )
    })
    expect(calls).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c'])
  })

  it('puts the previous status back when the write fails', async () => {
    const store = planStore()
    store.failWrites = true
    const { wrapper } = setup(store)
    const { result } = renderHook(
      () => ({ plan: useAcademicPlan(), set: useSetSubjectStatus() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.plan.views).toHaveLength(4))

    await act(async () => {
      await result.current.set
        .mutateAsync({ curriculumSubjectId: 'a', status: 'passed' })
        .catch(() => {})
    })
    await waitFor(() => expect(result.current.set.isError).toBe(true))
    expect(result.current.plan.views.find((v) => v.id === 'a')?.status).not.toBe('passed')
  })

  it('saves a whole year in one bulk write', async () => {
    const store = planStore()
    const { wrapper, calls } = setup(store)
    const { result } = renderHook(
      () => ({ plan: useAcademicPlan(), bulk: useSetSubjectStatuses() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.plan.views).toHaveLength(4))

    await act(async () => {
      await result.current.bulk.mutateAsync(
        ['a', 'b', 'c'].map((id) => ({ curriculumSubjectId: id, status: 'passed' as const })),
      )
    })
    expect(calls).toEqual(['start:a,b,c', 'end:a,b,c'])
    await waitFor(() =>
      expect(result.current.plan.views.filter((v) => v.status === 'passed')).toHaveLength(3),
    )
  })

  it('marks a manual subject through the manual cache', async () => {
    const store: Store = {
      context: context({ curriculumId: null, unmappedLabel: 'Mi carrera' }),
      states: [],
      manual: [
        { id: 'm1', name: 'Cálculo', yearLevel: 1, term: '1c', status: null, grade: null },
      ],
      subjects: [],
    }
    const { wrapper } = setup(store)
    const { result } = renderHook(
      () => ({ plan: useAcademicPlan(), set: useSetSubjectStatus() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.plan.views).toHaveLength(1))

    await act(async () => {
      await result.current.set.mutateAsync({
        curriculumSubjectId: 'm1',
        manual: true,
        status: 'passed',
      })
    })
    await waitFor(() => expect(result.current.plan.views[0]!.status).toBe('passed'))
  })

  it('a manual subject that was just added appears in the plan', async () => {
    const store: Store = {
      context: context({ curriculumId: null, unmappedLabel: 'Mi carrera' }),
      states: [],
      manual: [],
      subjects: [],
    }
    const { wrapper } = setup(store)
    const { result } = renderHook(
      () => ({ plan: useAcademicPlan(), add: useAddManualSubject() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.plan.isLoading).toBe(false))

    await act(async () => {
      await result.current.add.mutateAsync({ name: 'Álgebra', yearLevel: 1, term: 'anual' })
    })
    await waitFor(() =>
      expect(result.current.plan.views.map((v) => v.name)).toEqual(['Álgebra']),
    )
  })
})

describe('batch helpers', () => {
  const state = (id: string, status: UserSubjectState['status']): UserSubjectState => ({
    curriculumSubjectId: id,
    status,
    grade: null,
    startedAt: null,
    completedAt: null,
    notes: null,
  })

  it('applyStatusBatch sets, replaces and clears in one pass', () => {
    const next = applyStatusBatch(
      [state('a', 'in_progress'), state('b', 'passed')],
      [
        { curriculumSubjectId: 'a', status: 'passed' },
        { curriculumSubjectId: 'b', status: null },
        { curriculumSubjectId: 'c', status: 'equivalent' },
      ],
      new Date(2026, 9, 7),
    )
    expect(next.map((s) => [s.curriculumSubjectId, s.status])).toEqual([
      ['a', 'passed'],
      ['c', 'equivalent'],
    ])
  })

  it('applyManualBatch keeps the grade unless one is given, and skips unknown ids', () => {
    const subjects: ManualSubject[] = [
      { id: 'm1', name: 'A', yearLevel: 1, term: '1c', status: 'passed', grade: 8 },
    ]
    const inputs = [
      { curriculumSubjectId: 'm1', manual: true, status: 'in_progress' as const },
      { curriculumSubjectId: 'ghost', manual: true, status: 'passed' as const },
    ]
    expect(applyManualBatch(subjects, inputs)).toEqual([
      { id: 'm1', name: 'A', yearLevel: 1, term: '1c', status: 'in_progress', grade: 8 },
    ])
    expect(unknownManualIds(subjects, inputs)).toEqual(['ghost'])
  })
})
