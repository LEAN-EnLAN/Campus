/**
 * Test helpers: a fake Anthropic streaming response. Never hits the network.
 * Not imported by runtime code.
 */

export function sseFrame(payload: { type: string } & Record<string, unknown>): string {
  return `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`
}

/** A 200 SSE response whose body arrives in small chunks, splitting frames anywhere. */
export function sseResponse(frames: string[], chunkSize = 11): Response {
  const bytes = new TextEncoder().encode(frames.join(''))
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize))
      }
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

/** A plain text answer, the way the API streams it. */
export function textTurn(text: string): string[] {
  return [
    sseFrame({
      type: 'message_start',
      message: { id: 'msg_t', role: 'assistant', content: [] },
    }),
    sseFrame({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    }),
    ...text
      .split(/(?<= )/)
      .map((piece) =>
        sseFrame({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: piece },
        }),
      ),
    sseFrame({ type: 'content_block_stop', index: 0 }),
    sseFrame({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 5 },
    }),
    sseFrame({ type: 'message_stop' }),
  ]
}

/** One tool call (input streamed in two fragments), stop_reason tool_use. */
export function toolTurn(id: string, name: string, input: unknown): string[] {
  const json = JSON.stringify(input)
  const half = Math.floor(json.length / 2)
  return [
    sseFrame({
      type: 'message_start',
      message: { id: 'msg_u', role: 'assistant', content: [] },
    }),
    sseFrame({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'thinking', thinking: '', signature: '' },
    }),
    sseFrame({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'signature_delta', signature: 'sig' },
    }),
    sseFrame({ type: 'content_block_stop', index: 0 }),
    sseFrame({
      type: 'content_block_start',
      index: 1,
      content_block: { type: 'tool_use', id, name, input: {} },
    }),
    sseFrame({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: json.slice(0, half) },
    }),
    sseFrame({
      type: 'content_block_delta',
      index: 1,
      delta: { type: 'input_json_delta', partial_json: json.slice(half) },
    }),
    sseFrame({ type: 'content_block_stop', index: 1 }),
    sseFrame({ type: 'message_delta', delta: { stop_reason: 'tool_use' } }),
    sseFrame({ type: 'message_stop' }),
  ]
}

export function errorResponse(status: number, type: string): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message: 'x' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
