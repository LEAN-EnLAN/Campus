import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Resource } from '@/domain/types'
import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend } from '@/lib/backends/types'

import { MaterialFileLink } from './material-file-link'

const pdf: Resource = {
  id: 'r1',
  curriculumSubjectId: null,
  kind: 'file',
  title: 'Guía TP 1',
  url: null,
  storagePath: 'user-a/abc/guia.pdf',
  body: null,
  createdAt: '2026-11-19T12:00:00Z',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
}

function renderWith(files: CampusBackend['resources']['files']) {
  const backend = { resources: { files } } as unknown as CampusBackend
  return render(
    <BackendProvider backend={backend}>
      <MaterialFileLink resource={pdf} />
    </BackendProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MaterialFileLink', () => {
  it('opens the file in a new tab through a signed link asked for on click', async () => {
    const openUrl = vi.fn().mockResolvedValue('https://signed.example/guia.pdf?token=t')
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderWith({ openUrl })

    expect(screen.getByText(/Archivo · 2/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Guía TP 1/ }))

    expect(openUrl).toHaveBeenCalledWith(pdf)
    expect(tab.location.href).toBe('https://signed.example/guia.pdf?token=t')
    expect(tab.opener).toBeNull()
  })

  it('closes the blank tab and says why when the link is refused', async () => {
    const openUrl = vi.fn().mockRejectedValue(new Error('No pudimos abrir el archivo.'))
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    renderWith({ openUrl })

    await userEvent.click(screen.getByRole('button', { name: /Guía TP 1/ }))

    expect(tab.close).toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir el archivo.')
  })

  it('lists a Cloud file without a link where files cannot be opened', () => {
    renderWith(undefined)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Archivo guardado en Campus Cloud')).toBeInTheDocument()
  })
})
