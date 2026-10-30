import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { ValidResource } from '@/domain/resource-draft'

import { AddResourceDialog } from './add-resource-dialog'

const FILE_MESSAGE = /Por ahora Campus guarda links y notas; subir archivos llega más adelante/

/** The route's wiring, minus the backend: a trigger, the dialog, a save spy. */
function Harness({
  onSave,
  readClipboard,
  pasteClipboard,
  error = null,
}: {
  onSave: (resource: ValidResource) => Promise<unknown>
  readClipboard: () => Promise<string | null>
  pasteClipboard: () => Promise<string | null>
  error?: unknown
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Agregar material
      </button>
      <AddResourceDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={onSave}
        saving={false}
        error={error}
        readClipboard={readClipboard}
        pasteClipboard={pasteClipboard}
      />
    </>
  )
}

async function mount({
  clipboard = null,
  pasted = null,
  onSave = vi.fn<(resource: ValidResource) => Promise<unknown>>().mockResolvedValue(undefined),
  error = null,
}: {
  clipboard?: string | null
  pasted?: string | null
  onSave?: ReturnType<typeof vi.fn<(resource: ValidResource) => Promise<unknown>>>
  error?: unknown
} = {}) {
  const user = userEvent.setup()
  render(
    <Harness
      onSave={onSave}
      readClipboard={() => Promise.resolve(clipboard)}
      pasteClipboard={() => Promise.resolve(pasted)}
      error={error}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Agregar material' }))
  const dialog = await screen.findByRole('dialog', { name: 'Agregar material' })
  return { user, onSave, dialog }
}

/** Any non-field spot in the dialog: events bubble to the form that handles them. */
const surface = () => screen.getByRole('heading', { name: 'Agregar material' })

/** A paste outside any field: what Ctrl+V on the dialog surface dispatches. */
function pasteOn(target: Element, data: { text?: string; uriList?: string; files?: File[] }) {
  const event = createEvent.paste(target)
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) =>
        type === 'text/plain'
          ? (data.text ?? '')
          : type === 'text/uri-list'
            ? (data.uriList ?? '')
            : '',
      files: data.files ?? [],
    },
  })
  fireEvent(target, event)
}

function dropOn(target: Element, data: { text?: string; uriList?: string; files?: File[] }) {
  fireEvent.drop(target, {
    dataTransfer: {
      getData: (type: string) =>
        type === 'text/plain'
          ? (data.text ?? '')
          : type === 'text/uri-list'
            ? (data.uriList ?? '')
            : '',
      files: data.files ?? [],
      types: data.files?.length ? ['Files'] : ['text/plain'],
    },
  })
}

describe('AddResourceDialog', () => {
  it('turns a pasted URL into a link draft with a title, and saves it as a link', async () => {
    const { user, onSave } = await mount()

    pasteOn(surface(), {
      text: 'https://campus.unr.edu.ar/apuntes/guia-de-limites.pdf',
    })

    expect(screen.getByRole('textbox', { name: /Título/ })).toHaveValue('Guia de limites')
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(
      'https://campus.unr.edu.ar/apuntes/guia-de-limites.pdf',
    )
    expect(screen.getByRole('radio', { name: 'Link' })).toBeChecked()
    expect(onSave).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith({
      kind: 'link',
      title: 'Guia de limites',
      url: 'https://campus.unr.edu.ar/apuntes/guia-de-limites.pdf',
      body: null,
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the suggested title editable', async () => {
    const { user, onSave } = await mount()
    dropOn(surface(), { uriList: 'https://example.com/tp-2.pdf' })

    const title = screen.getByRole('textbox', { name: /Título/ })
    await user.clear(title)
    await user.type(title, 'TP 2 resuelto')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'TP 2 resuelto' }))
  })

  it('turns dropped plain text into a note', async () => {
    const { user, onSave } = await mount()

    dropOn(surface(), { text: 'Traer calculadora\nal parcial' })

    expect(screen.getByRole('radio', { name: 'Nota' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: /Título/ })).toHaveValue('Traer calculadora')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith({
      kind: 'note',
      title: 'Traer calculadora',
      url: null,
      body: 'Traer calculadora\nal parcial',
    })
  })

  it('is honest about dropped files and creates nothing', async () => {
    const { onSave } = await mount()

    dropOn(surface(), {
      files: [new File(['x'], 'apunte.pdf', { type: 'application/pdf' })],
      text: 'apunte.pdf',
    })

    expect(screen.getByRole('status')).toHaveTextContent(FILE_MESSAGE)
    expect(screen.queryByRole('textbox', { name: /Título/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('offers the copied link without saving it', async () => {
    const { user, onSave } = await mount({ clipboard: 'https://www.youtube.com/watch?v=abc' })

    const chip = await screen.findByRole('button', {
      name: 'Usar el link copiado: youtube.com',
    })
    expect(onSave).not.toHaveBeenCalled()
    await user.click(chip)

    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(
      'https://www.youtube.com/watch?v=abc',
    )
    expect(screen.getByRole('textbox', { name: /Título/ })).toHaveValue('youtube.com')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('suggests nothing when the clipboard has no link or cannot be read', async () => {
    await mount({ clipboard: 'texto suelto' })
    expect(
      screen.queryByRole('button', { name: /Usar el link copiado/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reads the clipboard only when the student clicks Pegar', async () => {
    const { user, onSave } = await mount({ pasted: 'https://example.com/tp-3.pdf' })

    await user.click(screen.getByRole('button', { name: 'Pegar lo que copiaste' }))

    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(
      'https://example.com/tp-3.pdf',
    )
    expect(screen.getByRole('textbox', { name: /Título/ })).toHaveValue('Tp 3')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('lets the student type a link by hand, with the same validation as before', async () => {
    const { user, onSave } = await mount()

    await user.click(screen.getByRole('button', { name: 'Escribir un link' }))
    const title = screen.getByRole('textbox', { name: /Título/ })
    expect(title).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(screen.getByText('Poné un título para el material.')).toHaveAttribute(
      'role',
      'alert',
    )
    expect(title).toHaveAttribute('aria-invalid', 'true')

    await user.type(title, 'Apunte')
    const link = screen.getByRole('textbox', { name: /Link/ })
    await user.type(link, 'campus.unr.edu.ar')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const urlError = screen.getByText('Ingresá un link que empiece con https:// o http://.')
    expect(link).toHaveAttribute('aria-invalid', 'true')
    expect(link.getAttribute('aria-describedby')).toContain(urlError.id)
    expect(onSave).not.toHaveBeenCalled()

    await user.clear(link)
    await user.type(link, 'https://campus.unr.edu.ar/x')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith({
      kind: 'link',
      title: 'Apunte',
      url: 'https://campus.unr.edu.ar/x',
      body: null,
    })
  })

  it('lets the student write a note by hand', async () => {
    const { user, onSave } = await mount()

    await user.click(screen.getByRole('button', { name: 'Escribir una nota' }))
    await user.type(screen.getByRole('textbox', { name: /Título/ }), 'Fechas de consulta')
    await user.type(screen.getByRole('textbox', { name: 'Nota' }), 'Martes 18 h')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onSave).toHaveBeenCalledWith({
      kind: 'note',
      title: 'Fechas de consulta',
      url: null,
      body: 'Martes 18 h',
    })
  })

  it('keeps the dialog and the draft when saving fails, and shows the error', async () => {
    const onSave = vi
      .fn<(resource: ValidResource) => Promise<unknown>>()
      .mockRejectedValue(new Error('No pudimos guardar el material.'))
    const { user } = await mount({
      onSave,
      error: new Error('No pudimos guardar el material.'),
    })

    pasteOn(surface(), { text: 'https://example.com/apunte' })
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('dialog', { name: 'Agregar material' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos guardar el material.')
    expect(screen.getByRole('textbox', { name: /Link/ })).toHaveValue(
      'https://example.com/apunte',
    )
  })
})
