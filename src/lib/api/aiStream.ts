import { ApiError, apiFetch, jsonBody, throwApiError } from './client'
import { AI_CHAT_TIMEOUT_MS, buildAiChatBody, chatWithAi, normalizeAiChatResponse, type AiChatResponse, type AiChatTurn } from './ai'

// Live progress for one streamed Ask AI turn. Status and text are provisional: the final
// response replaces them, because the server may rewrite the reply after the model finishes.
export interface AiStreamHandlers {
  onStatus?: (label: string) => void
  onDelta?: (text: string) => void
  // The model's earlier text was thinking out loud before it looked something up; drop it.
  onReset?: () => void
}

export interface SseEvent {
  event: string
  data: string
}

// Incremental server-sent-events parser. Network reads split lines anywhere, so text is held
// until a blank line closes an event. Comment lines (": keep-alive") are ignored.
export class SseParser {
  private buffer = ''

  push(chunk: string): SseEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n')
    const events: SseEvent[] = []
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      const event = parseBlock(block)
      if (event) events.push(event)
      boundary = this.buffer.indexOf('\n\n')
    }
    return events
  }

  flush(): SseEvent[] {
    const rest = this.buffer
    this.buffer = ''
    const event = parseBlock(rest)
    return event ? [event] : []
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split('\n')) {
    if (line.length === 0 || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return data.length > 0 ? { event, data: data.join('\n') } : null
}

const INTERRUPTED = 'The AI connection was interrupted. Please try again.'

// Same turn as chatWithAi, answered over /ai/chat/stream. The idle timeout restarts on every
// chunk (the server sends a keep-alive every 15 seconds), so a long multi-step answer is not cut
// off while it is still making progress.
export async function streamChatWithAi(
  turn: AiChatTurn,
  handlers: AiStreamHandlers,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  // Linked controller rather than AbortSignal.any(): the Android WebView we ship through
  // Capacitor can predate it.
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const armIdleTimeout = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { timedOut = true; controller.abort() }, AI_CHAT_TIMEOUT_MS)
  }
  const forwardAbort = () => controller.abort()
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })
  armIdleTimeout()

  try {
    const response = await apiFetch('/ai/chat/stream', {
      method: 'POST',
      ...jsonBody(buildAiChatBody(turn, 3)),
      signal: controller.signal,
    })
    // An API deployed before the streaming endpoint answers 404 without running the turn, so
    // the same turn id can safely go to the JSON endpoint instead.
    if (response.status === 404) {
      clearTimeout(timer)
      return await chatWithAi(
        turn.message, turn.history, turn.state, signal, turn.conversation, turn.context,
        turn.forceSensitiveMode ?? false, turn.accountMentions ?? [],
      )
    }
    if (!response.ok) await throwApiError(response, 'AI is unavailable. Please try again.', 'reply')

    const parser = new SseParser()
    const outcome: { result: AiChatResponse | null } = { result: null }
    const handle = (event: SseEvent) => {
      const data = JSON.parse(event.data) as Record<string, unknown>
      switch (event.event) {
        case 'status':
          if (typeof data.label === 'string') handlers.onStatus?.(data.label)
          break
        case 'delta':
          if (typeof data.text === 'string') handlers.onDelta?.(data.text)
          break
        case 'reset':
          handlers.onReset?.()
          break
        case 'done':
          outcome.result = normalizeAiChatResponse(data as Partial<AiChatResponse>)
          break
        case 'error': {
          const body = (data.response ?? {}) as Record<string, unknown>
          throw new ApiError(
            typeof body.reply === 'string' && body.reply ? body.reply : 'AI is unavailable. Please try again.',
            typeof data.status === 'number' ? data.status : 503,
          )
        }
      }
    }

    const reader = response.body?.getReader()
    if (reader) {
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        armIdleTimeout()
        parser.push(decoder.decode(value, { stream: true })).forEach(handle)
      }
      parser.push(decoder.decode()).forEach(handle)
    } else {
      // A WebView without streamed bodies still receives every event, just all at once.
      parser.push(await response.text()).forEach(handle)
    }
    parser.flush().forEach(handle)
    if (!outcome.result) throw new ApiError(INTERRUPTED, 0)
    return outcome.result
  } catch (error) {
    // The caller's own abort must stay an AbortError so the panel can ignore it; only our
    // idle timeout is rewritten into something the user can read.
    if (timedOut && !signal?.aborted) throw new ApiError('The AI took too long to respond. Please try again.', 504)
    if (error instanceof SyntaxError) throw new ApiError(INTERRUPTED, 0)
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
