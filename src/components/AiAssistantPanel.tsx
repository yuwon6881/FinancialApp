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
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-blue-500/20 bg-linear-to-b from-blue-500/[0.06] via-background to-background p-3 shadow-inner">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <div className="mb-3 grid size-11 place-items-center rounded-xl border border-blue-500/25 bg-blue-500/10 shadow-sm">
                <Sparkles className="size-5 text-blue-500" />
              </div>
              <p className="font-medium text-foreground">Ready.</p>
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
                      ? 'bg-linear-to-r from-blue-600 to-sky-500 text-white shadow-sm'
                      : 'border border-blue-500/15 bg-card/95 text-foreground shadow-sm'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="flex items-end gap-2 rounded-2xl border border-blue-500/20 bg-card/95 p-1.5 shadow-sm">
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
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-transparent bg-transparent px-3 py-2 text-sm outline-hidden focus:bg-background/80"
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
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-r from-blue-600 to-sky-500 text-white shadow-sm transition hover:brightness-105 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Send"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </BottomSheet>
  )
}
