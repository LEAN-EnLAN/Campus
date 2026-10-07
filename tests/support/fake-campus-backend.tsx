import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

import type {
  AcademicContext,
  CurriculumSubject,
  ManualSubject,
  PrerequisiteEdge,
  UserSubjectState,
} from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import { applyManualBatch, applyStatusBatch } from '@/lib/backends/normalize'
import type { CampusBackend, SetSubjectStatusInput } from '@/lib/backends/types'

/**
 * An in-memory CampusBackend for screen tests, plus a render helper that mounts
 * a screen inside the providers and a router that knows the app's paths.
 * Only the academic methods the screens call are implemented.
 */

export interface FakeStore {
  context: AcademicContext | null
  subjects: CurriculumSubject[]
  prerequisites: PrerequisiteEdge[]
  states: UserSubjectState[]
  manual: ManualSubject[]
  /** Every batch the screen wrote, in order. */
  writes: SetSubjectStatusInput[][]
}

export function emptyStore(over: Partial<FakeStore> = {}): FakeStore {
  return {
    context: {
      id: 'ctx',
      institutionId: null,
      academicUnitId: null,
      programId: null,
      curriculumId: 'plan-1',
      unmappedLabel: null,
      isActive: true,
    },
    subjects: [],
    prerequisites: [],
    states: [],
    manual: [],
    writes: [],
    ...over,
  }
}

export function fakeCampusBackend(store: FakeStore): CampusBackend {
  const setStatuses = async (inputs: SetSubjectStatusInput[]) => {
    store.writes.push(inputs)
    if (inputs[0]?.manual) store.manual = applyManualBatch(store.manual, inputs)
    else store.states = applyStatusBatch(store.states, inputs, new Date())
  }
  return {
    kind: 'local',
    catalog: {
      curriculumBundle: async () => ({
        curriculum: null,
        programName: 'Ingeniería',
        subjects: store.subjects,
        prerequisites: store.prerequisites,
        prerequisitesKnown: true,
        prerequisitesNote: null,
      }),
    },
    academic: {
      context: async () => store.context,
      subjectStates: async () => store.states,
      manualSubjects: async () => store.manual,
      setSubjectStatus: (input: SetSubjectStatusInput) => setStatuses([input]),
      setSubjectStatuses: setStatuses,
      addManualSubject: async (input: { name: string; yearLevel: number; term: never }) => {
        const added: ManualSubject = {
          id: `m${store.manual.length + 1}`,
          status: null,
          grade: null,
          ...input,
          name: input.name.trim(),
        }
        store.manual = [...store.manual, added]
        return added
      },
      removeManualSubject: async (id: string) => {
        store.manual = store.manual.filter((s) => s.id !== id)
      },
    },
  } as unknown as CampusBackend
}

export async function renderScreen(screen: ReactNode, backend: CampusBackend) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <BackendProvider backend={backend}>{screen}</BackendProvider>
      </QueryClientProvider>
    ),
  })
  const paths = ['/plan', '/plan/progress', '/courses', '/courses/$courseId', '/onboarding']
  const children = paths.map((path) =>
    createRoute({ getParentRoute: () => root, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: root.addChildren(children),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await router.load()
}
