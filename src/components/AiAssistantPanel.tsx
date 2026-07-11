import { useEffect, useState, useRef } from 'react'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { BottomSheet } from './ui/BottomSheet'
import * as api from '../lib/api'

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: api.AiUiAction[]) => void | Promise<void>
}

type ChatMessage = api.AiChatMessage
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

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

const pickSuggestedPrompts = () => {
  const prompts = [...SUGGESTED_PROMPTS]
  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[prompts[index], prompts[swapIndex]] = [prompts[swapIndex], prompts[index]]
  }
  return prompts.slice(0, 3)
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ isOpen, onClose, onActions }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState(pickSuggestedPrompts)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Structured conversation state from the last reply, echoed on the next request. Kept in a
  // ref (not state) so it never triggers a re-render and is always read fresh at send time.
  const conversationStateRef = useRef<api.AiConversationState | null>(null)

  const resetChat = () => {
    setMessages([])
    setInput('')
    conversationStateRef.current = null
  }

  useEffect(() => {
    resetChat()
    if (isOpen) setSuggestedPrompts(pickSuggestedPrompts())
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleClose = () => {
    resetChat()
    onClose()
  }

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)

    try {
      const result = await api.chatWithAi(trimmed, messages, conversationStateRef.current)
      conversationStateRef.current = result.state ?? null
      setMessages([...nextMessages, { role: 'assistant', content: result.reply || 'Done.' }])
      if (result.actions.length > 0) {
        const opensModalAction = result.actions.some(action =>
          action.type.startsWith('openAdd') || action.type.startsWith('openEdit')
        )
        if (opensModalAction) {
          handleClose()
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
      console.warn('Ask AI request failed', err)
      const content = err instanceof Error ? err.message : 'AI is unavailable. Please try again.'
      setMessages([...nextMessages, { role: 'assistant', content }])
    } finally {
      setIsSending(false)
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
    >
      <div className="flex h-[55vh] sm:h-[480px] flex-col gap-3">
        <div className={`min-h-0 flex-1 space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3 ${messages.length > 0 ? 'overflow-y-auto' : 'overflow-y-hidden'}`}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <div className="mb-3 grid size-11 place-items-center rounded-xl border border-border/60 bg-muted/40 shadow-xs">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Ready.</p>
              <div className="mt-4 flex max-w-md flex-wrap justify-center gap-2">
                {suggestedPrompts.map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-full border border-border/60 bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-foreground cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'border border-border/50 bg-card text-foreground shadow-xs'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
          {messages.length > 0 && <div ref={messagesEndRef} />}
        </div>

        <form onSubmit={sendMessage} className="flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 focus-within:border-primary/50 transition-colors shadow-xs">
          <textarea
            aria-label="Ask AI"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder=""
            rows={1}
            className="h-11 min-h-11 max-h-28 flex-1 resize-none rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm outline-hidden focus:bg-background/40"
          />
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground transition hover:bg-muted cursor-pointer"
            title="Close"
          >
            <X className="size-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs transition hover:bg-primary/95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Send"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
