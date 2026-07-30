import { Textarea } from './ui/Textarea'
import { useEffect, useState, useRef } from 'react'
import { Send, Sparkles, X, RotateCcw, SquarePen, Square } from 'lucide-react'
import { BottomSheet } from './ui/BottomSheet'
import { PerimeterBeam } from './ui/PerimeterBeam'
import type { AiUiAction } from '../lib/api/ai'
import { useAiConversation } from './useAiConversation'

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: AiUiAction[]) => void | Promise<void>
  sensitiveMode?: boolean
  isOffline?: boolean
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
  const [suggestedPrompts, setSuggestedPrompts] = useState(() => pickSuggestedPrompts(sensitiveMode))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    messages,
    input,
    setInput,
    isSending,
    isHydrating,
    isResetting,
    lastFailedTurn,
    resetError,
    sendMessage,
    newChat,
    cancelInFlight,
  } = useAiConversation({ isOpen, onClose, onActions, isOffline })

  useEffect(() => {
    if (isOpen && messages.length === 0) setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode))
  }, [isOpen, messages.length, sensitiveMode])

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

  const handleNewChat = async () => {
    await newChat()
    setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode))
  }

  if (!isOpen) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent-ink" />
          ASK AI
        </span>
      }
      headerActions={
        <>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void handleNewChat()}
              disabled={isResetting}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              title="Start a new chat (clears history)"
              aria-label="Start a new chat"
            >
              <SquarePen className="size-3.5" />
              <span>{isResetting ? 'Clearing…' : 'New chat'}</span>
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
          <span role="status" className="sr-only">{isHydrating ? 'Loading conversation…' : isSending ? 'Thinking…' : ''}</span>
          {resetError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {resetError}
            </div>
          )}
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
                  {message.role === 'assistant' && index === messages.length - 1 && lastFailedTurn && (
                    <button
                      type="button"
                      aria-label="Retry the last question"
                      onClick={() => void sendMessage(lastFailedTurn)}
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

        <form noValidate onSubmit={event => { event.preventDefault(); void sendMessage() }} className="flex items-end gap-2 rounded-xl border border-border bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          <Textarea
            ref={textareaRef}
            aria-label="Ask AI"
            disabled={isOffline || isHydrating || isResetting}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder={isOffline ? 'Ask AI is offline' : isHydrating ? 'Loading conversation…' : 'Ask about your finances…'}
            rows={1}
            className="min-h-11 max-h-40 flex-1 resize-none rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-sm leading-6 outline-hidden focus:border-transparent focus:ring-0 focus:outline-hidden placeholder:text-muted-foreground/70"
          />
          {/* While a turn is in flight the primary control becomes Stop, so a slow
              answer is never a dead end with a disabled button. */}
          <button
            type={isSending ? 'button' : 'submit'}
            onClick={isSending ? () => cancelInFlight({ recoverable: true }) : undefined}
            disabled={isSending ? false : (!input.trim() || isOffline || isHydrating || isResetting)}
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
