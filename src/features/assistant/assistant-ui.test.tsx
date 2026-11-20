import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AcademicShell } from '@/components/academic-shell'

import { renderRoute } from '../../../tests/unit/helpers/render-route'
import { AssistantPanel } from './assistant-panel'
import { AssistantSettingsSection } from './assistant-settings'
import { BriefingCard } from './briefing-card'
import type * as ContextModule from './context'
import { ASSISTANT_STORAGE_KEY, saveAssistantSettings } from './storage'

vi.mock('./context', async (importOriginal) => ({
  ...(await importOriginal<typeof ContextModule>()),
  useAssistantData: () => ({ data: null, isLoading: false }),
}))

const KEY = 'sk-ant-api03-ui-test-9876'

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('Ajustes → Asistente', () => {
  it('explains where the key lives and that requests go straight to Anthropic', () => {
    render(<AssistantSettingsSection />)
    expect(screen.getByRole('heading', { name: 'Asistente' })).toBeInTheDocument()
    expect(screen.getByText(/solo en este dispositivo/)).toBeInTheDocument()
    expect(screen.getByText(/directo de tu dispositivo a Anthropic/)).toBeInTheDocument()
    expect(screen.getByText(/Le pagás a Anthropic/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Modelo' })).toHaveValue('claude-sonnet-5-5')
  })

  it('asks for a key before saving', async () => {
    const user = userEvent.setup()
    render(<AssistantSettingsSection />)
    await user.click(screen.getByRole('button', { name: 'Guardar clave' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pegá tu clave de Anthropic.')
  })

  it('saves the key on this device, shows only its last digits, and deletes it', async () => {
    const user = userEvent.setup()
    render(<AssistantSettingsSection />)
    await user.type(screen.getByLabelText('Clave de API de Anthropic'), KEY)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Modelo' }),
      'claude-haiku-5-5',
    )
    await user.click(screen.getByRole('button', { name: 'Guardar clave' }))

    expect(JSON.parse(window.localStorage.getItem(ASSISTANT_STORAGE_KEY)!)).toEqual({
      apiKey: KEY,
      model: 'claude-haiku-5-5',
    })
    expect(screen.getByText(/termina en …9876/)).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(KEY)

    await user.click(screen.getByRole('button', { name: 'Borrar clave' }))
    expect(window.localStorage.getItem(ASSISTANT_STORAGE_KEY)).toBeNull()
    expect(screen.getByText('Todavía no cargaste una clave.')).toBeInTheDocument()
  })

  it('"Probar clave" reports an invalid key in Spanish', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { type: 'authentication_error' } }), {
          status: 401,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<AssistantSettingsSection />)
    await user.type(screen.getByLabelText('Clave de API de Anthropic'), KEY)
    await user.click(screen.getByRole('button', { name: 'Probar clave' }))

    expect(await screen.findByText(/La clave no es válida/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toMatch(
      /^https:\/\/api\.anthropic\.com\//,
    )
  })
})

describe('AssistantPanel', () => {
  it('without a key, points to Ajustes instead of a chat', async () => {
    renderRoute(() => <AssistantPanel open onOpenChange={vi.fn()} onProposeItem={vi.fn()} />)
    expect(await screen.findByRole('dialog', { name: 'Asistente' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Configurar el asistente/ })
    expect(link).toHaveAttribute('href', '/settings?seccion=asistente')
    expect(screen.queryByRole('textbox', { name: 'Tu pregunta' })).not.toBeInTheDocument()
  })

  it('with a key, offers the suggested prompts and a composer', async () => {
    saveAssistantSettings({ apiKey: KEY, model: 'claude-sonnet-5-5' })
    renderRoute(() => <AssistantPanel open onOpenChange={vi.fn()} onProposeItem={vi.fn()} />)
    expect(await screen.findByRole('button', { name: '¿Qué hago hoy?' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Tu pregunta' })).toBeInTheDocument()
  })

  it('closes with Escape', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    renderRoute(() => (
      <AssistantPanel open onOpenChange={onOpenChange} onProposeItem={vi.fn()} />
    ))
    await screen.findByRole('dialog', { name: 'Asistente' })
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders nothing while closed', () => {
    renderRoute(() => (
      <AssistantPanel open={false} onOpenChange={vi.fn()} onProposeItem={vi.fn()} />
    ))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('BriefingCard', () => {
  it('renders nothing without a key', () => {
    const client = new QueryClient()
    const { container } = render(
      <QueryClientProvider client={client}>
        <BriefingCard />
      </QueryClientProvider>,
    )
    expect(container.querySelector('section')).toBeNull()
  })
})

describe('AcademicShell entry point', () => {
  it('shows the sparkle button only when the shell is given onAssistant', async () => {
    const onAssistant = vi.fn()
    const user = userEvent.setup()
    renderRoute(() => (
      <AcademicShell onQuickCapture={vi.fn()} onSearch={vi.fn()} onAssistant={onAssistant}>
        <p>contenido</p>
      </AcademicShell>
    ))
    const buttons = await screen.findAllByRole('button', { name: 'Abrir asistente' })
    await user.click(buttons[0]!)
    expect(onAssistant).toHaveBeenCalledTimes(1)
  })
})
