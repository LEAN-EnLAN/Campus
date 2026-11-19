import { describe, expect, it, vi } from 'vitest'

import type { MessageParam } from '@/lib/ai/anthropic-client'
import { AssistantError } from '@/lib/ai/errors'
import { errorResponse, sseFrame, sseResponse, textTurn, toolTurn } from '@/lib/ai/test-sse'

import { runAssistantTurn } from './chat'
import { assistantData } from './fixtures'
import type { ItemProposal } from './tools'

const settings = { apiKey: 'sk-ant-test', model: 'claude-haiku-5-5' } as const

function bodyOf(fetchImpl: ReturnType<typeof vi.fn>, call: number) {
  const init = (fetchImpl.mock.calls[call] as unknown as [string, RequestInit])[1]
  return JSON.parse(init.body as string) as { messages: MessageParam[]; system: string }
}

describe('runAssistantTurn', () => {
  it('runs the tool the model asks for and sends every result back before answering', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sseResponse(toolTurn('tu_1', 'get_pending_finals', {})))
      .mockResolvedValueOnce(sseResponse(textTurn('Rendí Análisis Matemático I primero.')))
    let text = ''
    const history = await runAssistantTurn({
      settings,
      history: [],
      question: '¿Qué final me conviene rendir primero?',
      data: assistantData(),
      fetchImpl,
      callbacks: { onText: (d) => (text += d) },
    })

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const second = bodyOf(fetchImpl, 1)
    // The assistant turn is echoed verbatim (thinking included), then ONE user message of results.
    expect(second.messages[1]).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'thinking', signature: 'sig' },
        { type: 'tool_use', id: 'tu_1' },
      ],
    })
    expect(second.messages[2]).toMatchObject({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tu_1' }],
    })
    expect(JSON.stringify(second.messages[2])).toContain('Análisis Matemático I')
    expect(second.system).toContain('rioplatense')
    expect(second.system).toContain('2026-11-19')
    expect(history).toHaveLength(4)
    expect(text).toBe('Rendí Análisis Matemático I primero.')
  })

  it('surfaces propose_item as a card and never writes anything itself', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse(
          toolTurn('tu_p', 'propose_item', {
            title: 'TP 3',
            kind: 'assignment',
            date: '2026-11-27',
          }),
        ),
      )
      .mockResolvedValueOnce(sseResponse(textTurn('Te dejé la tarjeta para guardarla.')))
    const proposals: ItemProposal[] = []
    await runAssistantTurn({
      settings,
      history: [],
      question: 'Agendá el TP 3 para el 27',
      data: assistantData(),
      fetchImpl,
      callbacks: { onProposal: (p) => proposals.push(p) },
    })
    expect(proposals).toEqual([expect.objectContaining({ title: 'TP 3', whenLabel: '27/11' })])
    // Only api.anthropic.com was called: nothing reached the backend.
    for (const [url] of fetchImpl.mock.calls as unknown as [string][]) {
      expect(url.startsWith('https://api.anthropic.com/')).toBe(true)
    }
  })

  it('stops on a refusal with a friendly error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([sseFrame({ type: 'message_delta', delta: { stop_reason: 'refusal' } })]),
      )
    await expect(
      runAssistantTurn({
        settings,
        history: [],
        question: 'x',
        data: assistantData(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ kind: 'refusal' })
  })

  it('propagates typed API errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(errorResponse(429, 'rate_limit_error'))
    const error: unknown = await runAssistantTurn({
      settings,
      history: [],
      question: 'x',
      data: assistantData(),
      fetchImpl,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AssistantError)
    expect((error as AssistantError).kind).toBe('rate_limit')
  })
})
