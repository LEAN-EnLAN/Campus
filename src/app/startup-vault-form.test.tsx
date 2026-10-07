import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CampusBackend } from '@/lib/backends/types'
import { RuntimeProvider } from '@/lib/runtime/context'
import type { DeviceStore } from '@/lib/runtime/device-config'
import type { RuntimeCapabilities } from '@/lib/runtime/resolve'
import type { CampusRuntime } from '@/lib/runtime/types'
import { VaultError, type VaultErrorCode } from '@/lib/vault/errors'

import { Startup } from './startup'

/**
 * The open-Vault form. The first thing a new student does is type a path, so a
 * wrong one has to read as help: Enter submits, the error is Spanish and says
 * WHICH mistake it was, it goes away when the text changes, and the card does
 * not jump when it appears.
 */

function memoryStore(): DeviceStore {
  let value: string | null = null
  return { get: () => value, set: (v) => (value = v) }
}

function mount(openLocal: RuntimeCapabilities['openLocal']) {
  const caps: RuntimeCapabilities = {
    vaultAvailable: true,
    store: memoryStore(),
    vaultExists: async () => true,
    openLocal,
    cloudSession: async () => false,
    openCloud: async () => ({ mode: 'cloud', backend: {} as CampusBackend }) as CampusRuntime,
  }
  return render(
    <RuntimeProvider capabilities={caps} fallback={() => <Startup />}>
      <p>app abierta</p>
    </RuntimeProvider>,
  )
}

const refuse = (code: VaultErrorCode) =>
  vi.fn(async () => {
    throw new VaultError(code, 'vault not found')
  })

const opens = () =>
  vi.fn(
    async (vault) => ({ mode: 'local', vault, backend: {} as CampusBackend }) as CampusRuntime,
  )

const field = () => screen.findByRole('textbox', { name: 'Ruta de la carpeta' })

describe('submitting', () => {
  it('Enter in the path field opens the Vault', async () => {
    const user = userEvent.setup()
    const openLocal = opens()
    mount(openLocal)

    await user.type(await field(), '/home/vos/Campus{Enter}')

    expect(openLocal).toHaveBeenCalledOnce()
    expect(await screen.findByText('app abierta')).toBeInTheDocument()
  })

  it('the Abrir button still works, and an empty field submits nothing', async () => {
    const user = userEvent.setup()
    const openLocal = opens()
    mount(openLocal)

    const input = await field()
    await user.type(input, '{Enter}')
    expect(openLocal).not.toHaveBeenCalled()

    await user.type(input, '/home/vos/Campus')
    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(openLocal).toHaveBeenCalledOnce()
  })
})

describe('errors', () => {
  it.each([
    ['folder_not_found', 'No encontramos esa carpeta. Revisá la ruta.'],
    ['folder_not_directory', 'Esa ruta no es una carpeta.'],
    [
      'folder_outside_roots',
      'Esa carpeta queda fuera de las que Campus puede abrir: elegí una dentro de tu carpeta personal.',
    ],
    ['permission_denied', 'Campus no tiene permiso para hacer eso en esa carpeta.'],
    ['folder_not_absolute', 'La ruta tiene que ser completa, desde la raíz del disco.'],
  ] as const)('%s reads as a Spanish sentence', async (code, sentence) => {
    const user = userEvent.setup()
    mount(refuse(code))

    await user.type(await field(), '/algun/lugar{Enter}')

    expect(await screen.findByText(sentence)).toBeInTheDocument()
    expect(screen.queryByText(/vault not found|not a directory/i)).toBeNull()
  })

  it('never shows the raw text of an unexpected failure', async () => {
    const user = userEvent.setup()
    mount(
      vi.fn(async () => {
        throw new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`)
      }),
    )

    await user.type(await field(), '/x{Enter}')

    expect(await screen.findByText(/probá de nuevo/)).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected token/)).toBeNull()
  })

  it('disappears as soon as the text changes', async () => {
    const user = userEvent.setup()
    mount(refuse('folder_not_found'))
    const input = await field()

    await user.type(input, '/mal{Enter}')
    expect(await screen.findByText(/No encontramos esa carpeta/)).toBeInTheDocument()

    await user.type(input, 'x')
    expect(screen.queryByText(/No encontramos esa carpeta/)).toBeNull()
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('is linked to the field for screen readers', async () => {
    const user = userEvent.setup()
    mount(refuse('folder_not_found'))
    const input = await field()
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.type(input, '/mal{Enter}')
    const message = await screen.findByText(/No encontramos esa carpeta/)

    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(message.id)
  })

  it('reserves the error line, so the card does not jump when it appears', async () => {
    const user = userEvent.setup()
    mount(refuse('folder_not_found'))
    const input = await field()

    // The element exists, empty, BEFORE any error — and is the same node after.
    const before = document.getElementById('vault-path-error')
    expect(before).not.toBeNull()
    expect(before).toBeEmptyDOMElement()
    expect(before!.className).toMatch(/min-h-/)

    await user.type(input, '/mal{Enter}')
    await screen.findByText(/No encontramos esa carpeta/)
    expect(document.getElementById('vault-path-error')).toBe(before)
  })
})
