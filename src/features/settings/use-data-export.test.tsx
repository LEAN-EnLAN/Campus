import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AcademicItem } from '@/domain/types'
import { dateOnlyDueAt } from '@/features/items/due'
import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend } from '@/lib/backends/types'

import { EXPORT_FORMAT_VERSION } from './export-data'
import { useDataExport } from './use-data-export'

const download = vi.hoisted(() => ({ file: vi.fn() }))
vi.mock('@/lib/download', () => ({
  downloadFile: (...args: unknown[]) => download.file(...args),
}))

const items: AcademicItem[] = [
  {
    id: 'i1',
    curriculumSubjectId: 'alg',
    kind: 'midterm',
    title: 'Parcial',
    startsAt: null,
    dueAt: dateOnlyDueAt(2026, 11, 18),
    status: 'open',
    notes: 'mis notas',
  },
  {
    id: 'i2',
    curriculumSubjectId: null,
    kind: 'task',
    title: 'Sin fecha',
    startsAt: null,
    dueAt: null,
    status: 'open',
    notes: null,
  },
]

/** Only what the export reads. */
function backend(over: { failItems?: boolean } = {}): CampusBackend {
  return {
    kind: 'local',
    academic: {
      context: async () => ({
        id: 'ctx',
        institutionId: 'utn',
        academicUnitId: null,
        programId: null,
        curriculumId: 'plan',
        unmappedLabel: null,
        isActive: true,
      }),
      subjectStates: async () => [
        {
          curriculumSubjectId: 'alg',
          status: 'passed',
          grade: 8,
          startedAt: null,
          completedAt: null,
          notes: null,
        },
      ],
      manualSubjects: async () => [],
    },
    items: {
      list: async () => {
        if (over.failItems) throw new Error('offline')
        return items
      },
    },
    resources: { list: async () => [] },
  } as unknown as CampusBackend
}

const wrap =
  (value: CampusBackend) =>
  ({ children }: { children: ReactNode }) => (
    <BackendProvider backend={value}>{children}</BackendProvider>
  )

beforeEach(() => download.file.mockReset())

describe('Descargar mis datos (JSON)', () => {
  it('writes every section, with the export date and the format version', async () => {
    const { result } = renderHook(() => useDataExport(), { wrapper: wrap(backend()) })

    await act(() => result.current.downloadJson({ workspace: 'local', folderName: 'Facu' }))

    expect(download.file).toHaveBeenCalledOnce()
    const [name, content, type] = download.file.mock.calls[0] as [string, string, string]
    expect(name).toMatch(/^campus-mis-datos-\d{4}-\d{2}-\d{2}\.json$/)
    expect(type).toBe('application/json;charset=utf-8')
    const data = JSON.parse(content)
    expect(data).toMatchObject({
      format: 'campus-export',
      version: EXPORT_FORMAT_VERSION,
      profile: { workspace: 'local', folderName: 'Facu' },
      academicContext: { curriculumId: 'plan' },
      subjectStates: [{ curriculumSubjectId: 'alg', status: 'passed', grade: 8 }],
      manualSubjects: [],
      items,
      resources: [],
    })
    expect(Number.isNaN(Date.parse(data.exportedAt))).toBe(false)
  })

  it('says so, in Spanish, when the data cannot be read', async () => {
    const { result } = renderHook(() => useDataExport(), {
      wrapper: wrap(backend({ failItems: true })),
    })

    await act(() => result.current.downloadJson({ workspace: 'cloud', email: null }))

    expect(download.file).not.toHaveBeenCalled()
    expect(result.current.error).toMatch(/No pudimos preparar el archivo/)
    expect(result.current.pending).toBeNull()
  })
})

describe('Mis fechas (.ics)', () => {
  it('exports every dated item and leaves the undated out', async () => {
    const { result } = renderHook(() => useDataExport(), { wrapper: wrap(backend()) })

    await act(() => result.current.downloadCalendar(() => 'Álgebra'))

    const [name, content] = download.file.mock.calls[0] as [string, string]
    expect(name).toMatch(/^campus-mis-fechas-\d{4}-\d{2}-\d{2}\.ics$/)
    expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(content).toContain('SUMMARY:Parcial · Álgebra · 18/11')
  })
})
