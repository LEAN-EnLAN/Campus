import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/components/toast'
import { BackendProvider } from '@/lib/backends/context'
import type { CampusBackend, SendFeedbackInput } from '@/lib/backends/types'

import { renderRoute } from '../../../tests/unit/helpers/render-route'

import { version } from '../../../package.json'

import { FeedbackDialog } from './feedback-dialog'

vi.mock('./feedback-channel', () => ({ FEEDBACK_EMAIL: 'equipo@example.org' }))

function mount(backend: CampusBackend, onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  renderRoute(
    () => (
      <QueryClientProvider client={client}>
        <BackendProvider backend={backend}>
          <ToastProvider>
            <FeedbackDialog open onClose={onClose} />
          </ToastProvider>
        </BackendProvider>
      </QueryClientProvider>
    ),
    '/today',
  )
  return onClose
}

function cloud(send: (input: SendFeedbackInput) => Promise<void>) {
  return { kind: 'cloud', feedback: { send } } as unknown as CampusBackend
}

describe('Contanos algo', () => {
  it('sends the text with the current route and app version, then thanks the student', async () => {
    const user = userEvent.setup()
    const send = vi.fn(async () => undefined)
    const onClose = mount(cloud(send))

    const dialog = await screen.findByRole('dialog', { name: 'Contanos algo' })
    const submit = within(dialog).getByRole('button', { name: 'Enviar' })
    expect(submit).toBeDisabled()

    await user.type(
      within(dialog).getByLabelText('¿Qué nos querés contar?'),
      'Falta modo oscuro',
    )
    await user.click(submit)

    expect(send).toHaveBeenCalledWith({
      body: 'Falta modo oscuro',
      route: '/today',
      appVersion: version,
    })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(screen.getByRole('status')).toHaveTextContent('Gracias, lo leemos')
  })

  it('disables the button while sending', async () => {
    const user = userEvent.setup()
    let finish!: () => void
    const send = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    mount(cloud(send))

    const dialog = await screen.findByRole('dialog', { name: 'Contanos algo' })
    await user.type(within(dialog).getByLabelText('¿Qué nos querés contar?'), 'Hola')
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }))

    const busy = await within(dialog).findByRole('button', { name: 'Enviando…' })
    expect(busy).toBeDisabled()
    await user.click(busy)
    expect(send).toHaveBeenCalledTimes(1)
    finish()
  })

  it('keeps the text and says so when sending fails', async () => {
    const user = userEvent.setup()
    const onClose = mount(cloud(() => Promise.reject(new Error('offline'))))

    const dialog = await screen.findByRole('dialog', { name: 'Contanos algo' })
    const field = within(dialog).getByLabelText('¿Qué nos querés contar?')
    await user.type(field, 'No anda')
    await user.click(within(dialog).getByRole('button', { name: 'Enviar' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No pudimos enviar')
    expect(field).toHaveValue('No anda')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('in Local offers a mail link instead of a form: nothing is sent from the app', async () => {
    mount({ kind: 'local' } as unknown as CampusBackend)
    const dialog = await screen.findByRole('dialog', { name: 'Contanos algo' })
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).getByText(/Campus no envía nada desde la app/)).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'equipo@example.org' })).toHaveAttribute(
      'href',
      `mailto:equipo@example.org?subject=${encodeURIComponent(`Campus ${version}`)}`,
    )
  })
})
