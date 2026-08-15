import type {
  AcademicContext,
  AcademicItem,
  AcademicUnit,
  Curriculum,
  Institution,
  Program,
  Resource,
  UserSubjectState,
} from '@/domain/types'
import { backendError } from '@/lib/backends/types'
import type {
  CampusBackend,
  CreateItemInput,
  CreateResourceInput,
  CurriculumBundle,
  SaveContextInput,
  SetSubjectStatusInput,
} from '@/lib/backends/types'
import type { VaultAccess } from '@/lib/vault/vault-access'

import { store } from './academic-store'
import {
  toAcademicUnit,
  toCurriculum,
  toCurriculumSubject,
  toInstitution,
  toPrerequisiteEdges,
  toProgram,
} from './catalog'
import type { PortableCatalog } from './catalog'
import { ulid } from './ulid'

/**
 * LOCAL-003 — the whole backend, over a folder the student chose.
 *
 * No account, no network, no Supabase. The sixteen methods are the sixteen the
 * hooks already had; there is nothing here that a screen does not call.
 *
 * Reference data (institutions → curricula) is READ from the portable catalog.
 * The student's own data lives in four readable JSON files under
 * `.campus/academic/`, written one at a time, atomically, through the vault.
 */
export class LocalBackend implements CampusBackend {
  readonly kind = 'local' as const

  private readonly vault: VaultAccess
  private readonly source: PortableCatalog

  constructor(vault: VaultAccess, source: PortableCatalog) {
    this.vault = vault
    this.source = source
  }

  // ------------------------------------------------------------------ catalog

  catalog = {
    institutions: async (): Promise<Institution[]> =>
      this.source.institutions.map(toInstitution),

    academicUnits: async (institutionId: string): Promise<AcademicUnit[]> => {
      const institution = this.source.institutions.find((i) => i.slug === institutionId)
      return (institution?.academicUnits ?? []).map((u) => toAcademicUnit(u, institutionId))
    },

    programs: async (academicUnitId: string): Promise<Program[]> => {
      for (const institution of this.source.institutions) {
        const unit = institution.academicUnits.find((u) => u.slug === academicUnitId)
        if (unit) return unit.programs.map((p) => toProgram(p, academicUnitId))
      }
      return []
    },

    curricula: async (programId: string): Promise<Curriculum[]> => {
      const out: Curriculum[] = []
      for (const raw of this.source.curricula.values()) {
        if (raw.program.slug === programId) out.push(toCurriculum(raw))
      }
      return out.sort((a, b) => a.version.localeCompare(b.version))
    },

    curriculumBundle: async (curriculumId: string): Promise<CurriculumBundle> => {
      const raw = this.source.curricula.get(curriculumId)
      if (!raw) {
        return {
          curriculum: null,
          programName: null,
          subjects: [],
          prerequisites: [],
          // An absent plan is not a plan without correlativas. Saying `true`
          // here would let a missing plan render as "nothing blocks you".
          prerequisitesKnown: false,
          prerequisitesNote: 'No encontramos este plan en el catálogo.',
        }
      }

      return {
        curriculum: toCurriculum(raw),
        programName: raw.program.name,
        subjects: raw.subjects.map((s) => toCurriculumSubject(s, raw.id)),
        prerequisites: toPrerequisiteEdges(raw),
        // Carried through from the catalog, which carried it from the research
        // provenance. Never re-derived from the edge list.
        prerequisitesKnown: raw.prerequisitesKnown,
        prerequisitesNote: raw.prerequisitesNote,
      }
    },
  }

  // ----------------------------------------------------------------- academic

  academic = {
    context: async (): Promise<AcademicContext | null> => {
      const { value } = await store.read<AcademicContext | null>(
        this.vault,
        'context',
        'context',
        null,
      )
      return value
    },

    saveContext: async (input: SaveContextInput): Promise<AcademicContext> => {
      const next: AcademicContext = {
        id: 'local',
        institutionId: input.institutionId,
        academicUnitId: input.academicUnitId,
        programId: input.programId,
        curriculumId: input.curriculumId,
        unmappedLabel: input.unmappedLabel,
        isActive: true,
      }
      await store.update<AcademicContext | null>(
        this.vault,
        'context',
        'context',
        null,
        () => next,
      )
      return next
    },

    subjectStates: async (): Promise<UserSubjectState[]> => {
      const { value } = await store.read<UserSubjectState[]>(
        this.vault,
        'subject-state',
        'states',
        [],
      )
      return value
    },

    setSubjectStatus: async (input: SetSubjectStatusInput): Promise<void> => {
      await store.update<UserSubjectState[]>(
        this.vault,
        'subject-state',
        'states',
        [],
        (states) => {
          const rest = states.filter((s) => s.curriculumSubjectId !== input.curriculumSubjectId)
          // `null` clears the row. `available` and `pending` are derived from
          // the prerequisite graph, so a cleared subject must be ABSENT here —
          // storing a placeholder would let the file drift from the graph.
          if (input.status === null) return rest

          const previous = states.find(
            (s) => s.curriculumSubjectId === input.curriculumSubjectId,
          )
          return [
            ...rest,
            {
              curriculumSubjectId: input.curriculumSubjectId,
              status: input.status,
              grade: input.grade ?? previous?.grade ?? null,
              startedAt: previous?.startedAt ?? null,
              completedAt: previous?.completedAt ?? null,
              notes: previous?.notes ?? null,
            },
          ]
        },
      )
    },
  }

  // -------------------------------------------------------------------- items

  items = {
    list: async (): Promise<AcademicItem[]> => {
      const { value } = await store.read<AcademicItem[]>(this.vault, 'items', 'items', [])
      return value
    },

    create: async (input: CreateItemInput): Promise<AcademicItem> => {
      const item: AcademicItem = {
        id: ulid(),
        curriculumSubjectId: input.curriculumSubjectId,
        kind: input.kind,
        title: input.title,
        startsAt: null,
        dueAt: input.dueAt,
        status: 'open',
        notes: input.notes ?? null,
      }
      await store.update<AcademicItem[]>(this.vault, 'items', 'items', [], (items) => [
        ...items,
        item,
      ])
      return item
    },

    setDone: async (id: string, done: boolean): Promise<void> => {
      await store.update<AcademicItem[]>(this.vault, 'items', 'items', [], (items) => {
        if (!items.some((i) => i.id === id)) {
          backendError('No encontramos esa fecha en tu vault', `unknown item ${id}`)
        }
        return items.map((i) => (i.id === id ? { ...i, status: done ? 'done' : 'open' } : i))
      })
    },

    remove: async (id: string): Promise<void> => {
      await store.update<AcademicItem[]>(this.vault, 'items', 'items', [], (items) =>
        items.filter((i) => i.id !== id),
      )
    },
  }

  // ---------------------------------------------------------------- resources

  resources = {
    list: async (): Promise<Resource[]> => {
      const { value } = await store.read<Resource[]>(this.vault, 'resources', 'resources', [])
      return value
    },

    create: async (input: CreateResourceInput): Promise<Resource> => {
      const resource: Resource = {
        id: ulid(),
        curriculumSubjectId: input.curriculumSubjectId,
        kind: input.kind,
        title: input.title,
        url: input.url,
        storagePath: null,
        body: input.body,
        createdAt: new Date().toISOString(),
      }
      await store.update<Resource[]>(this.vault, 'resources', 'resources', [], (all) => [
        ...all,
        resource,
      ])
      return resource
    },

    remove: async (id: string): Promise<void> => {
      await store.update<Resource[]>(this.vault, 'resources', 'resources', [], (all) =>
        all.filter((r) => r.id !== id),
      )
    },
  }
}
