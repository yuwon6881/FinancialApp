import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  }
  return {
    ApiError,
    apiFetch: vi.fn(),
    request: vi.fn(),
    requestVoid: vi.fn(),
    jsonBody: (value: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }),
    throwApiError: vi.fn(async (response: Response, fallback: string) => {
      throw new ApiError(fallback, response.status)
    }),
  }
})

vi.mock('./ai', async importOriginal => ({
  ...(await importOriginal<typeof import('./ai')>()),
  chatWithAi: vi.fn(),
}))

import * as client from './client'
import * as ai from './ai'
import { SseParser, streamChatWithAi } from './aiStream'

const apiFetch = client.apiFetch as unknown as ReturnType<typeof vi.fn>
const chatWithAi = ai.chatWithAi as unknown as ReturnType<typeof vi.fn>

const turn = { message: 'when is my latest haircut?', history: [] }

const sse = (...events: [string, unknown][]) =>
  events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('')

// Delivers the body in chunks of the given size, splitting lines and multibyte characters.
const streamedResponse = (body: string, chunkSize: number, status = 200) => {
  const bytes = new TextEncoder().encode(body)
  return new Response(new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) controller.enqueue(bytes.slice(offset, offset + chunkSize))
      controller.close()
    },
  }), { status, headers: { 'Content-Type': 'text/event-stream' } })
}

const done = { reply: 'On 14 Feb 2026 — at Barber King.', actions: [], closeChat: false, conversationId: 'c1', conversationVersion: 2 }

afterEach(() => {
  apiFetch.mockReset()
  chatWithAi.mockReset()
})

describe('SseParser', () => {
  it('assembles events split across arbitrary chunks and skips keep-alive comments', () => {
    const parser = new SseParser()
    const text = ': keep-alive\n\nevent: status\ndata: {"label":"Searching"}\r\n\r\nevent: delta\ndata: {"text":"hi"}\n\n'
    const events = [...text].flatMap(character => parser.push(character))

    expect(events).toEqual([
      { event: 'status', data: '{"label":"Searching"}' },
      { event: 'delta', data: '{"text":"hi"}' },
    ])
  })

  it('joins multi-line data and flushes a final unterminated event', () => {
    const parser = new SseParser()
    expect(parser.push('event: done\ndata: line one\ndata: line two')).toEqual([])
    expect(parser.flush()).toEqual([{ event: 'done', data: 'line one\nline two' }])
  })
})

describe('streamChatWithAi', () => {
  it('reports status and text as they arrive and resolves with the done response', async () => {
    apiFetch.mockResolvedValue(streamedResponse(sse(
      ['status', { label: 'Searching your transactions for “haircut”' }],
      ['delta', { text: 'On 14 Feb 2026 — ' }],
      ['reset', {}],
      ['delta', { text: 'at Barber King.' }],
      ['done', done],
    ), 3))
    const onStatus = vi.fn()
    const onDelta = vi.fn()
    const onReset = vi.fn()

    const result = await streamChatWithAi(turn, { onStatus, onDelta, onReset })

    expect(onStatus).toHaveBeenCalledWith('Searching your transactions for “haircut”')
    expect(onDelta.mock.calls.map(call => call[0])).toEqual(['On 14 Feb 2026 — ', 'at Barber King.'])
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(result.reply).toBe('On 14 Feb 2026 — at Barber King.')
    expect(result.conversationVersion).toBe(2)
    const [path, init] = apiFetch.mock.calls[0]
    expect(path).toBe('/ai/chat/stream')
    expect(JSON.parse(init.body).clientContractVersion).toBe(3)
  })

  it('turns an error event into an ApiError with the status the JSON endpoint would use', async () => {
    apiFetch.mockResolvedValue(streamedResponse(sse(['error', { status: 409, response: { reply: 'This conversation changed on another device.' } }]), 64))

    await expect(streamChatWithAi(turn, {})).rejects.toMatchObject({ status: 409, message: 'This conversation changed on another device.' })
  })

  it('treats a stream that ends without a final answer as an interrupted connection', async () => {
    apiFetch.mockResolvedValue(streamedResponse(sse(['delta', { text: 'partial' }]), 64))

    await expect(streamChatWithAi(turn, {})).rejects.toMatchObject({ status: 0 })
  })

  it('falls back to the JSON endpoint when the API predates streaming', async () => {
    apiFetch.mockResolvedValue(new Response('', { status: 404 }))
    chatWithAi.mockResolvedValue({ ...done, reply: 'from json' })

    const result = await streamChatWithAi({ ...turn, conversation: { conversationId: null, conversationVersion: null, clientTurnId: 't1' } }, {})

    expect(result.reply).toBe('from json')
    expect(chatWithAi.mock.calls[0][0]).toBe(turn.message)
    expect(chatWithAi.mock.calls[0][4]).toEqual({ conversationId: null, conversationVersion: null, clientTurnId: 't1' })
  })

  it('reads the whole body at once when the runtime cannot stream it', async () => {
    const body = sse(['done', done])
    apiFetch.mockResolvedValue({ ok: true, status: 200, body: null, text: async () => body } as unknown as Response)

    await expect(streamChatWithAi(turn, {})).resolves.toMatchObject({ reply: done.reply })
  })
})
