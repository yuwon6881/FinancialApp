import { useEffect, useState, useRef } from 'react'
import { Send, Sparkles, X, RotateCcw, SquarePen, Square } from 'lucide-react'
import { BottomSheet } from './ui/BottomSheet'
import { PerimeterBeam } from './ui/PerimeterBeam'
import * as api from '../lib/api'

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: api.AiUiAction[]) => void | Promise<void>
  sensitiveMode?: boolean
  isOffline?: boolean
}

type ChatMessage = api.AiChatMessage
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

// Transport-level failures reach us as bare `ApiError('401 Unauthorized')` or a raw
// `TypeError('Failed to fetch')`; only the statuses the API answers with a `reply`
// body carry copy that is fit to render in a chat bubble.
const describeChatError = (error: unknown): string => {
  if (error instanceof api.ApiError) {
    if (error.status === 401 || error.status === 423) return 'Your session ended. Sign in again to keep chatting.'
    if (error.status === 429) return 'Too many requests right now. Please wait a moment and try again.'
    if (error.status === 0 || error.status >= 500) return error.message || 'AI is unavailable. Please try again.'
    return error.message || 'AI could not handle that request.'
  }
  return 'AI is unavailable. Please check your connection and try again.'
}

// Keep discovery prompts local: static UI copy does not justify an AI round trip.
const SUGGESTED_PROMPTS = [
  'Which transaction exceeded 250 this cycle?',
  'How long until my Growth reaches 50000?',
  'How much do my subscriptions cost me a month?',
  'Compare my spending this cycle vs last cycle',
  'Are there any duplicate transactions this cycle?',
  'What unusual spending happened this cycle?',
  'Which subscriptions are due next?',
  'How much did I spend on Food this cycle?',
  'Which wishlist items can I afford now?',
  'Show my most recent transactions',
]

const SENSITIVE_SUGGESTED_PROMPTS = [
  'Are there any duplicate transactions this cycle?',
  'What unusual spending happened this cycle?',
  'Which subscriptions are due next?',
  'Which subscriptions are inactive?',
  'Show my most recent transactions',
  'Show my transfer transactions this cycle',
]

const pickSuggestedPrompts = (sensitiveMode: boolean) => {
  const prompts = [...(sensitiveMode ? SENSITIVE_SUGGESTED_PROMPTS : SUGGESTED_PROMPTS)]
  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[prompts[index], prompts[swapIndex]] = [prompts[swapIndex], prompts[index]]
  }
  return prompts.slice(0, 3)
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ isOpen, onClose, onActions, sensitiveMode = true, isOffline = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null)
  const [suggestedPrompts, setSuggestedPrompts] = useState(() => pickSuggestedPrompts(sensitiveMode))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeRequestRef = useRef<AbortController | null>(null)
  const requestGenerationRef = useRef(0)
  // Structured conversation state from the last reply, echoed on the next request. Kept in a
  // ref (not state) so it never triggers a re-render and is always read fresh at send time.
  const conversationStateRef = useRef<api.AiConversationState | null>(null)

  const resetChat = () => {
    setMessages([])
    setInput('')
    setLastFailedInput(null)
    conversationStateRef.current = null
  }

  // `pendingInput` lets a cancel leave a recoverable turn behind instead of an
  // orphaned user bubble with no answer and no Retry affordance.
  const pendingInputRef = useRef<string | null>(null)

  const cancelInFlight = (options: { recoverable?: boolean } = {}) => {
    const wasSending = activeRequestRef.current !== null
    requestGenerationRef.current += 1
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setIsSending(false)
    const pending = pendingInputRef.current
    pendingInputRef.current = null
    if (!wasSending || !options.recoverable || !pending) return
    setLastFailedInput(pending)
    setMessages(current => [...current, { role: 'assistant', content: 'Cancelled before the AI answered. Tap Retry to ask again.' }])
  }

  const handleNewChat = () => {
    cancelInFlight()
    resetChat()
    setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode))
  }

  // History is intentionally preserved across close/reopen — closing the sheet only
  // aborts any in-flight request. Use the "New chat" control to clear the conversation.
  useEffect(() => {
    if (isOpen) {
      if (messages.length === 0) setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode))
    } else {
      cancelInFlight({ recoverable: true })
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && messages.length === 0) setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode))
  }, [sensitiveMode])

  useEffect(() => {
    if (isOffline) cancelInFlight({ recoverable: true })
  }, [isOffline])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const adjustTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = 160
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [input, isOpen])

  const handleClose = () => {
    cancelInFlight({ recoverable: true })
    onClose()
  }

  const sendMessage = async (e?: React.FormEvent, retryText?: string) => {
    e?.preventDefault()
    const trimmed = (retryText ?? input).trim()
    if (!trimmed || isSending || isOffline) return

    const nextMessages: ChatMessage[] = retryText
      ? messages.slice(0, -1)
      : [...messages, { role: 'user', content: trimmed }]
    const apiHistory = retryText
      ? messages.slice(0, -2)
      : lastFailedInput ? messages.slice(0, -1) : messages

    setLastFailedInput(null)
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation
    const controller = new AbortController()
    activeRequestRef.current?.abort()
    activeRequestRef.current = controller
    pendingInputRef.current = trimmed

    try {
      const result = await api.chatWithAi(trimmed, apiHistory, conversationStateRef.current, controller.signal)
      if (generation !== requestGenerationRef.current) return
      // The turn landed: the action handlers below may close the panel, and the close
      // path must not mistake that for a cancellation.
      pendingInputRef.current = null
      conversationStateRef.current = result.state ?? null
      setMessages([...nextMessages, { role: 'assistant', content: result.reply || 'Done.' }])
      if (result.actions.length > 0) {
        const requiresPanelClose = result.actions.some(action =>
          action.type.startsWith('openAdd') || action.type.startsWith('openEdit') ||
          action.type.startsWith('request') || action.type === 'openLedgerExport'
        )
        if (requiresPanelClose) {
          onClose()
          await nextFrame()
          await onActions(result.actions)
          return
        }

        await onActions(result.actions)
        if (result.closeChat) {
          handleClose()
          return
        }
      }
    } catch (err) {
      if (controller.signal.aborted || generation !== requestGenerationRef.current) return
      console.warn('Ask AI request failed', err)
      pendingInputRef.current = null
      setLastFailedInput(trimmed)
      setMessages([...nextMessages, { role: 'assistant', content: describeChatError(err) }])
    } finally {
      if (generation === requestGenerationRef.current) {
        activeRequestRef.current = null
        pendingInputRef.current = null
        setIsSending(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          ASK AI
        </span>
      }
      headerActions={
        <>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Start a new chat (clears history)"
              aria-label="Start a new chat"
            >
              <SquarePen className="size-3.5" />
              <span>New chat</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            title="Close"
            aria-label="Close Ask AI"
          >
            <X className="size-4" />
          </button>
        </>
      }
    >
      <div className="flex h-[55vh] sm:h-[480px] flex-col gap-3">
        {/* The non-scrolling wrapper owns a subtle perimeter-only activity trace. */}
        <div className={`relative min-h-0 flex-1 rounded-xl ${isSending ? 'perimeter-beam-host' : ''}`}>
          {isSending && <PerimeterBeam size={132} duration={7} />}
          <div
            role="log"
            aria-live="polite"
            aria-busy={isSending}
            className={`h-full space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3 ${messages.length > 0 ? 'overflow-y-auto' : 'overflow-y-hidden'}`}
          >
          {/* The spinner and the perimeter beam are both decorative, so announce
              progress separately for screen readers. */}
          <span role="status" className="sr-only">{isSending ? 'Thinking…' : ''}</span>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <div className="mb-3 grid size-11 place-items-center rounded-xl border border-border/60 bg-muted/40 shadow-xs">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Ready.</p>
              {isOffline && <p className="mt-2 text-[11px] font-medium text-orange-500">Ask AI requires an internet connection.</p>}
              <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {suggestedPrompts.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isOffline}
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <p className="mt-4 max-w-md text-[10px] leading-relaxed text-muted-foreground/80">
                Relevant financial details are sent to the configured AI provider.
                {sensitiveMode ? ' Sensitive mode keeps amounts hidden and disables record changes.' : ' Record changes still require your confirmation, except recurring on/off toggles.'}
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex flex-col gap-1 items-start ${message.role === 'user' ? 'items-end' : ''} max-w-[85%]`}>
                  <div
                    className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'border border-border/50 bg-card text-foreground shadow-xs'
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === 'assistant' && index === messages.length - 1 && lastFailedInput && (
                    <button
                      type="button"
                      aria-label="Retry the last question"
                      onClick={() => void sendMessage(undefined, lastFailedInput)}
                      className="flex items-center gap-1.5 px-2 py-1 mt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <RotateCcw className="size-3" />
                      Retry
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {messages.length > 0 && <div ref={messagesEndRef} />}
          </div>
        </div>

        <form noValidate onSubmit={sendMessage} className="flex items-end gap-2 rounded-xl border border-border bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <textarea
            ref={textareaRef}
            aria-label="Ask AI"
            disabled={isOffline}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder={isOffline ? 'Ask AI is offline' : 'Ask about your finances…'}
            rows={1}
            className="min-h-11 max-h-40 flex-1 resize-none rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-sm leading-6 outline-hidden placeholder:text-muted-foreground/70"
          />
          {/* While a turn is in flight the primary control becomes Stop, so a slow
              answer is never a dead end with a disabled button. */}
          <button
            type={isSending ? 'button' : 'submit'}
            onClick={isSending ? () => cancelInFlight({ recoverable: true }) : undefined}
            disabled={isSending ? false : (!input.trim() || isOffline)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition hover:bg-primary/95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title={isSending ? 'Stop' : 'Send'}
            aria-label={isSending ? 'Stop generating' : 'Send message'}
          >
            {isSending ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
