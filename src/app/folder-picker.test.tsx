import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { VaultError } from '@/lib/vault/errors'
import type { FolderListing } from '@/lib/vault/http-vault-access'

import { FolderPicker } from './folder-picker'

/**
 * The in-app folder picker: the machine that runs Campus may not be the one the
 * page is open on, so the folders come from the server. The model is the one a
 * student already knows from Finder or Explorer: where am I (breadcrumb), what is
 * inside (a list), go in, go up, and one button to take THIS folder.
 */

const TREE: Record<string, string[]> = {
  '/home/ana': ['Documentos', 'Facultad', 'Música', 'Zeta'],
  '/home/ana/Documentos': ['Campus'],
  '/home/ana/Documentos/Campus': [],
  '/home/ana/Facultad': ['Álgebra', 'Análisis'],
}

const listing = (path: string): FolderListing => {
  const parent = path === '/home/ana' ? null : path.slice(0, path.lastIndexOf('/'))
  return { path, parent, dirs: TREE[path] ?? [] }
}

function mount(
  over: {
    listFolders?: (path?: string) => Promise<FolderListing>
    onChoose?: (path: string) => void
    onClose?: () => void
  } = {},
) {
  const listFolders =
    over.listFolders ?? vi.fn(async (path?: string) => listing(path ?? '/home/ana'))
  const onChoose = over.onChoose ?? vi.fn()
  const onClose = over.onClose ?? vi.fn()
  render(<FolderPicker listFolders={listFolders} onChoose={onChoose} onClose={onClose} />)
  return { listFolders, onChoose, onClose }
}

const filter = () => screen.findByRole('combobox', { name: 'Filtrar carpetas' })
const rowNames = () => screen.getAllByRole('option').map((o) => o.textContent)

describe('FolderPicker', () => {
  it('opens as a labelled dialog on the first folder the server offers', async () => {
    mount()

    expect(await screen.findByRole('dialog', { name: 'Elegir carpeta' })).toBeInTheDocument()
    await filter()
    expect(rowNames()).toEqual(['Documentos', 'Facultad', 'Música', 'Zeta'])
    const crumbs = screen.getByRole('navigation', { name: 'Ruta' })
    expect(within(crumbs).getByText('Inicio')).toHaveAttribute('aria-current', 'page')
  })

  it('moves the highlight with the arrows and goes into a folder with Enter', async () => {
    const user = userEvent.setup()
    mount()
    const input = await filter()

    await user.keyboard('{ArrowDown}')
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', options[1]!.id)

    await user.keyboard('{Enter}') // Facultad
    expect(await screen.findByRole('option', { name: 'Álgebra' })).toBeInTheDocument()
    expect(rowNames()).toEqual(['Álgebra', 'Análisis'])
    const crumbs = screen.getByRole('navigation', { name: 'Ruta' })
    expect(within(crumbs).getByText('Facultad')).toHaveAttribute('aria-current', 'page')
    expect(within(crumbs).getByRole('button', { name: 'Inicio' })).toBeInTheDocument()
  })

  it('a double click goes in, a single click only highlights', async () => {
    const user = userEvent.setup()
    const { listFolders } = mount()
    await filter()

    await user.click(screen.getByRole('option', { name: 'Documentos' }))
    expect(screen.getByRole('option', { name: 'Documentos' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(listFolders).toHaveBeenCalledTimes(1)

    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    expect(await screen.findByRole('option', { name: 'Campus' })).toBeInTheDocument()
  })

  it('narrows the list as you type, ignoring accents and case', async () => {
    const user = userEvent.setup()
    mount()
    await filter()

    await user.keyboard('musica')
    expect(rowNames()).toEqual(['Música'])

    await user.clear(await filter())
    await user.keyboard('ZET')
    expect(rowNames()).toEqual(['Zeta'])
  })

  it('says so when nothing matches, and offers nothing to choose', async () => {
    const user = userEvent.setup()
    mount()
    await filter()

    await user.keyboard('qqq')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText(/Ninguna carpeta se llama «qqq»/)).toBeInTheDocument()
  })

  it('goes up with the button, with Backspace on an empty filter, and from the breadcrumb', async () => {
    const user = userEvent.setup()
    mount()
    await filter()
    expect(screen.getByRole('button', { name: 'Subir un nivel' })).toBeDisabled()

    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    await screen.findByRole('option', { name: 'Campus' })
    await user.click(screen.getByRole('button', { name: 'Subir un nivel' }))
    expect(await screen.findByRole('option', { name: 'Zeta' })).toBeInTheDocument()

    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    await screen.findByRole('option', { name: 'Campus' })
    await user.keyboard('{Backspace}')
    expect(await screen.findByRole('option', { name: 'Zeta' })).toBeInTheDocument()

    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    await user.dblClick(await screen.findByRole('option', { name: 'Campus' }))
    await screen.findByText(/No hay carpetas acá adentro/)
    await user.click(screen.getByRole('button', { name: 'Inicio' }))
    expect(await screen.findByRole('option', { name: 'Zeta' })).toBeInTheDocument()
  })

  it('takes the folder you are in, not the highlighted one', async () => {
    const user = userEvent.setup()
    const { onChoose } = mount()
    await filter()

    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    await screen.findByRole('option', { name: 'Campus' })
    expect(screen.getByText(/Vas a usar: Documentos/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usar esta carpeta' }))

    expect(onChoose).toHaveBeenCalledExactlyOnceWith('/home/ana/Documentos')
  })

  it('calls the top folder "Inicio" rather than by its (personal) name', async () => {
    mount()
    await filter()

    expect(screen.getByText('Vas a usar: Inicio')).toBeInTheDocument()
  })

  it('Ctrl+Enter chooses the current folder', async () => {
    const user = userEvent.setup()
    const { onChoose } = mount()
    await filter()

    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(onChoose).toHaveBeenCalledExactlyOnceWith('/home/ana')
  })

  it('says an empty folder is empty, and that it can still be used', async () => {
    const user = userEvent.setup()
    mount()
    await filter()
    await user.dblClick(screen.getByRole('option', { name: 'Documentos' }))
    await user.dblClick(await screen.findByRole('option', { name: 'Campus' }))

    expect(await screen.findByText(/No hay carpetas acá adentro/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar esta carpeta' })).toBeEnabled()
  })

  it('closes on Escape and on Cancelar', async () => {
    const user = userEvent.setup()
    const { onClose } = mount()
    const dialog = await screen.findByRole('dialog', { name: 'Elegir carpeta' })

    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('a refused folder gets one plain sentence and the same answer for every reason', async () => {
    const user = userEvent.setup()
    const listFolders = vi.fn(async (path?: string) => {
      if (path === '/home/ana/Facultad') throw new VaultError('folder_not_found', 'x')
      return listing(path ?? '/home/ana')
    })
    mount({ listFolders })
    await filter()

    await user.dblClick(screen.getByRole('option', { name: 'Facultad' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No podemos mostrar esa carpeta')
    // Still somewhere to go: the previous folder stays on screen.
    expect(screen.getByRole('option', { name: 'Zeta' })).toBeInTheDocument()
  })

  it('a lost connection says so and can be retried', async () => {
    const user = userEvent.setup()
    let down = true
    const listFolders = vi.fn(async (path?: string) => {
      if (down) throw new VaultError('unavailable', 'x')
      return listing(path ?? '/home/ana')
    })
    mount({ listFolders })

    expect(await screen.findByRole('alert')).toHaveTextContent('Perdimos la conexión')
    expect(screen.getByRole('button', { name: 'Usar esta carpeta' })).toBeDisabled()

    down = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('option', { name: 'Zeta' })).toBeInTheDocument()
  })
})
