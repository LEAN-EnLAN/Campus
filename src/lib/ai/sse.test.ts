import { describe, expect, it } from 'vitest'

import { createSseParser, readSse } from './sse'

describe('createSseParser', () => {
  it('emits one frame per blank-line-terminated block', () => {
    const parser = createSseParser()
    const frames = parser.feed(
      'event: ping\ndata: {"a":1}\n\nevent: message_stop\ndata: {}\n\n',
    )
    expect(frames).toEqual([
      { event: 'ping', data: '{"a":1}' },
      { event: 'message_stop', data: '{}' },
    ])
  })

  it('keeps a frame split across chunks until it is complete', () => {
    const parser = createSseParser()
    expect(parser.feed('event: content_block_delta\nda')).toEqual([])
    expect(parser.feed('ta: {"text":"Ho')).toEqual([])
    expect(parser.feed('la"}\n')).toEqual([])
    expect(parser.feed('\n')).toEqual([
      { event: 'content_block_delta', data: '{"text":"Hola"}' },
    ])
  })

  it('handles CRLF even when \\r and \\n land in different chunks', () => {
    const parser = createSseParser()
    expect(parser.feed('data: x\r')).toEqual([])
    expect(parser.feed('\n\r\n')).toEqual([{ event: 'message', data: 'x' }])
  })

  it('ignores comments and joins multi-line data', () => {
    const parser = createSseParser()
    expect(parser.feed(': keep-alive\ndata: uno\ndata: dos\n\n')).toEqual([
      { event: 'message', data: 'uno\ndos' },
    ])
  })

  it('flushes a last frame that never got its blank line', () => {
    const parser = createSseParser()
    expect(parser.feed('event: message_stop\ndata: {}')).toEqual([])
    expect(parser.flush()).toEqual([{ event: 'message_stop', data: '{}' }])
  })
})

describe('readSse', () => {
  it('decodes a byte stream, including multi-byte characters split between chunks', async () => {
    const bytes = new TextEncoder().encode('data: {"t":"cuatrimestre ñ"}\n\n')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
        controller.close()
      },
    })
    const frames = []
    for await (const frame of readSse(body)) frames.push(frame)
    expect(frames).toEqual([{ event: 'message', data: '{"t":"cuatrimestre ñ"}' }])
  })
})
