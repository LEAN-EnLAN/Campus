/**
 * Incremental Server-Sent Events parser.
 *
 * The Messages API streams `event:` / `data:` frames separated by a blank line.
 * Chunks from `fetch` split anywhere (mid-line, mid-frame, even between `\r`
 * and `\n`), so the parser keeps whatever is incomplete for the next `feed`.
 */

export interface SseFrame {
  /** The `event:` field; `message` when the frame names none (SSE default). */
  event: string
  /** Every `data:` line of the frame, joined with `\n`. */
  data: string
}

export interface SseParser {
  /** Feed a decoded chunk; returns the frames it completed. */
  feed(chunk: string): SseFrame[]
  /** End of stream: a final frame without its trailing blank line still counts. */
  flush(): SseFrame[]
}

export function createSseParser(): SseParser {
  let buffer = ''
  let event = ''
  let data: string[] = []

  function dispatch(out: SseFrame[]) {
    if (data.length > 0) out.push({ event: event || 'message', data: data.join('\n') })
    event = ''
    data = []
  }

  function line(text: string, out: SseFrame[]) {
    if (text === '') return dispatch(out)
    if (text.startsWith(':')) return // comment / keep-alive
    const colon = text.indexOf(':')
    const field = colon === -1 ? text : text.slice(0, colon)
    let value = colon === -1 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    // `id` and `retry` are irrelevant here.
  }

  return {
    feed(chunk) {
      buffer += chunk
      const out: SseFrame[] = []
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer)
        if (!match) break
        // A lone `\r` at the very end may be the first half of `\r\n`.
        if (match[0] === '\r' && match.index === buffer.length - 1) break
        line(buffer.slice(0, match.index), out)
        buffer = buffer.slice(match.index + match[0].length)
      }
      return out
    },
    flush() {
      const out: SseFrame[] = []
      if (buffer !== '') line(buffer.replace(/\r$/, ''), out)
      buffer = ''
      dispatch(out)
      return out
    },
  }
}

/** Every frame of a byte stream, in order. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseFrame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parser = createSseParser()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      yield* parser.feed(decoder.decode(value, { stream: true }))
    }
    yield* parser.feed(decoder.decode())
    yield* parser.flush()
  } finally {
    reader.releaseLock()
  }
}
