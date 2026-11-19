import { describe, expect, it, vi } from 'vitest'

import { checkApiKey, streamMessage, type StreamRequest } from './anthropic-client'
import { AssistantError, friendlyMessage, kindFromStatus } from './errors'
import { errorResponse, sseFrame, sseResponse, textTurn, toolTurn } from './test-sse'

const KEY = 'sk-ant-test-0000-secret'

function request(fetchImpl: typeof fetch, extra: Partial<StreamRequest> = {}): StreamRequest {
  return {
    apiKey: KEY,
    model: 'claude-sonnet-5-5',
    system: 'sistema',
    messages: [{ role: 'user', content: '¿Qué hago hoy?' }],
    fetchImpl,
    ...extra,
  }
}

async function failure(promise: Promise<unknown>): Promise<AssistantError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof AssistantError) return error
    throw error
  }
  throw new Error('expected a failure')
}

describe('streamMessage', () => {
  it('goes straight to Anthropic with the browser-access header and the key only in x-api-key', async () => {
    const fetchImpl = vi.fn(async () => sseResponse(textTurn('Hola')))
    await streamMessage(request(fetchImpl as unknown as typeof fetch))

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(headers['x-api-key']).toBe(KEY)
    expect(headers['anthropic-version']).toBe('2026-10-21')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(init.body).not.toContain(KEY)
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5',
      stream: true,
      fallbacks: 'default',
    })
    expect(body).not.toHaveProperty('temperature')
  })

  it('does not send the Sonnet-only fallback to Haiku', async () => {
    const fetchImpl = vi.fn(async () => sseResponse(textTurn('Hola')))
    await streamMessage(
      request(fetchImpl as unknown as typeof fetch, { model: 'claude-haiku-5-5' }),
    )
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(init.body).not.toContain('fallbacks')
    expect(init.headers).not.toHaveProperty('anthropic-beta')
  })

  it('streams text deltas and assembles the final blocks', async () => {
    const deltas: string[] = []
    const result = await streamMessage(
      request(async () => sseResponse(textTurn('Hoy tenés el TP 2')), {
        onText: (d) => deltas.push(d),
      }),
    )
    expect(deltas.join('')).toBe('Hoy tenés el TP 2')
    expect(deltas.length).toBeGreaterThan(1)
    expect(result.content).toEqual([{ type: 'text', text: 'Hoy tenés el TP 2' }])
    expect(result.stopReason).toBe('end_turn')
  })

  it('rebuilds tool input from json fragments and keeps thinking blocks verbatim', async () => {
    const result = await streamMessage(
      request(async () => sseResponse(toolTurn('tu_1', 'get_upcoming', { days: 7 }))),
    )
    expect(result.stopReason).toBe('tool_use')
    expect(result.content).toEqual([
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'tu_1', name: 'get_upcoming', input: { days: 7 } },
    ])
    expect(result.invalidToolUseIds).toEqual([])
  })

  it('flags a tool input that is not valid JSON instead of throwing', async () => {
    const frames = [
      sseFrame({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'tu_bad', name: 'get_upcoming', input: {} },
      }),
      sseFrame({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: '{"days": ' },
      }),
      sseFrame({ type: 'content_block_stop', index: 0 }),
      sseFrame({ type: 'message_delta', delta: { stop_reason: 'tool_use' } }),
    ]
    const result = await streamMessage(request(async () => sseResponse(frames)))
    expect(result.invalidToolUseIds).toEqual(['tu_bad'])
    expect(result.content[0]).toMatchObject({ type: 'tool_use', input: {} })
  })
})

describe('error mapping', () => {
  it.each([
    [401, 'authentication_error', 'invalid_key'],
    [429, 'rate_limit_error', 'rate_limit'],
    [529, 'overloaded_error', 'overloaded'],
    [400, 'invalid_request_error', 'bad_request'],
    [500, 'api_error', 'server'],
  ] as const)('HTTP %i (%s) → %s', async (status, type, kind) => {
    const error = await failure(streamMessage(request(async () => errorResponse(status, type))))
    expect(error.kind).toBe(kind)
    expect(error.status).toBe(status)
    expect(error.message).toBe(friendlyMessage(kind))
  })

  it('falls back to the status when the body is not JSON', () => {
    expect(kindFromStatus(401)).toBe('invalid_key')
    expect(kindFromStatus(429)).toBe('rate_limit')
    expect(kindFromStatus(529)).toBe('overloaded')
    expect(kindFromStatus(503)).toBe('server')
  })

  it('a failed fetch is a network error', async () => {
    const error = await failure(
      streamMessage(
        request(async () => {
          throw new TypeError('Failed to fetch')
        }),
      ),
    )
    expect(error.kind).toBe('network')
    expect(error.message).toMatch(/conexión/)
  })

  it('an aborted request is "aborted", not a failure to report', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = await failure(
      streamMessage(
        request(
          async () => {
            throw new DOMException('aborted', 'AbortError')
          },
          { signal: controller.signal },
        ),
      ),
    )
    expect(error.kind).toBe('aborted')
  })

  it('an error event in the middle of the stream is mapped too', async () => {
    const frames = [
      ...textTurn('Hola').slice(0, 3),
      sseFrame({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }),
    ]
    const error = await failure(streamMessage(request(async () => sseResponse(frames))))
    expect(error.kind).toBe('overloaded')
  })

  it('never puts the key in an error message', async () => {
    const error = await failure(
      streamMessage(request(async () => errorResponse(401, 'authentication_error'))),
    )
    expect(error.message).not.toContain(KEY)
    expect(String(error)).not.toContain(KEY)
  })
})

describe('checkApiKey', () => {
  it('asks for the model with a GET (no tokens spent)', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    await checkApiKey(KEY, 'claude-haiku-5-5', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/models/claude-haiku-5-5')
    expect(init.method).toBe('GET')
  })

  it('reports an invalid key in Spanish', async () => {
    const error = await failure(
      checkApiKey(KEY, 'claude-sonnet-5-5', {
        fetchImpl: async () => errorResponse(401, 'authentication_error'),
      }),
    )
    expect(error.kind).toBe('invalid_key')
    expect(error.message).toMatch(/clave no es válida/)
  })
})
