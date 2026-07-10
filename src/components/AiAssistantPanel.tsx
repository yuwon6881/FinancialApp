import { useEffect, useState } from 'react'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { BottomSheet } from './ui/BottomSheet'
import * as api from '../lib/api'

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: api.AiUiAction[]) => void | Promise<void>
}

type ChatMessage = api.AiChatMessage

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ isOpen, onClose, onActions }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const resetChat = () => {
    setMessages([])
    setInput('')
  }

  useEffect(() => {
    resetChat()
  }, [isOpen])

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
      const result = await api.chatWithAi(trimmed, messages)
      setMessages([...nextMessages, { role: 'assistant', content: result.reply || 'Done.' }])
      if (result.actions.length > 0) {
        await onActions(result.actions)
        const hasEditAction = result.actions.some(action => action.type.startsWith('openEdit'))
        if (result.closeChat && !hasEditAction) {
          handleClose()
          return
        }
      }
    } catch {
      setMessages([...nextMessages, { role: 'assistant', content: 'AI is unavailable. Please try again.' }])
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
          <Sparkles className="size-4 text-blue-500" />
          ASK AI
        </span>
      }
    >
      <div className="flex h-[min(68vh,560px)] flex-col gap-3">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <Sparkles className="mb-3 size-6 text-blue-500" />
              <p>Ask for cycle analysis, ledger filters, draft entries, or wishlist and subscription insights.</p>
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
                      ? 'bg-blue-600 text-white'
                      : 'border border-border/60 bg-card text-foreground'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Ask about this cycle, open a ledger filter, or draft a record..."
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-hidden focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:bg-muted cursor-pointer"
            title="Close"
          >
            <X className="size-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Send"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
