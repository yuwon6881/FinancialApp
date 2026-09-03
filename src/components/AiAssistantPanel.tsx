import { Textarea } from './ui/Textarea'
import { useEffect, useMemo, useState, useRef } from 'react'
import { Send, Sparkles, X, RotateCcw, SquarePen, Square } from 'lucide-react'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'
import { PerimeterBeam } from './ui/PerimeterBeam'
import type { AiUiAction } from '../lib/api/ai'
import type { AppTab, LedgerAccount } from '../types'
import { useAiConversation, type AiInvocationRequest } from './useAiConversation'
import { AccountMentionMenu } from './ai/AccountMentionMenu'
import { useAccountMentionComposer } from './ai/useAccountMentionComposer'
import { AccountMentionText, AiMessageContent } from './ai/AiMessageContent'
import { motionSafeScrollBehavior } from '../lib/motionPreference'

interface AiAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: AiUiAction[]) => void | Promise<void>
  sensitiveMode?: boolean
  isOffline?: boolean
  invocation?: AiInvocationRequest | null
  onInvocationConsumed?: () => void
  surface?: AppTab
  accounts?: LedgerAccount[]
}

// A stable empty default: a fresh [] each render would re-run every memo keyed on the account list.
const EMPTY_ACCOUNTS: LedgerAccount[] = []

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
  'Which rewards can I afford now?',
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

const SURFACE_SUGGESTED_PROMPTS: Partial<Record<AppTab, string[]>> = {
  reports: ['Compare this cycle with the previous one', 'What unusual spending happened this cycle?', 'Review this cycle'],
  investments: ['Explain my portfolio', 'What is On paper versus Already banked?', 'Which holdings have incomplete prices?'],
  wishlist: ['Explain my plan', 'Which rewards can I afford now?', 'How are my commitments pacing?'],
}

const pickSuggestedPrompts = (sensitiveMode: boolean, surface?: AppTab) => {
  const prompts = [...(sensitiveMode ? SENSITIVE_SUGGESTED_PROMPTS : (surface ? SURFACE_SUGGESTED_PROMPTS[surface] : undefined) ?? SUGGESTED_PROMPTS)]
  for (let index = prompts.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[prompts[index], prompts[swapIndex]] = [prompts[swapIndex], prompts[index]]
  }
  return prompts.slice(0, 3)
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  isOpen,
  onClose,
  onActions,
  sensitiveMode = true,
  isOffline = false,
  invocation = null,
  onInvocationConsumed = () => undefined,
  surface,
  accounts = EMPTY_ACCOUNTS,
}) => {
  const [suggestedPrompts, setSuggestedPrompts] = useState(() => pickSuggestedPrompts(sensitiveMode, surface))
  const defaultContext = useMemo(() => ({
    surface: surface ?? 'dashboard',
  }), [surface])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerHighlightRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    input,
    setInput,
    isSending,
    isHydrating,
    isResetting,
    lastFailedTurn,
    recoverableTurn,
    recoverStoppedTurn,
    dismissStoppedTurn,
    resetError,
    sendMessage,
    newChat,
    cancelInFlight,
    historyRedacted,
    hasConversation,
    pendingActionBatches,
    resumeActionBatch,
    dismissActionBatch,
  } = useAiConversation({
    isOpen,
    onClose,
    onActions,
    isOffline,
    sensitiveMode,
    defaultContext,
    invocation,
    onInvocationConsumed,
    accounts,
  })
  const mentions = useAccountMentionComposer({ input, setInput, accounts, textareaRef })

  useEffect(() => {
    if (isOpen && messages.length === 0) setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode, surface))
  }, [isOpen, messages.length, sensitiveMode, surface])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: motionSafeScrollBehavior() })
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

  const syncComposerScroll = () => {
    if (!textareaRef.current || !composerHighlightRef.current) return
    composerHighlightRef.current.scrollTop = textareaRef.current.scrollTop
    composerHighlightRef.current.scrollLeft = textareaRef.current.scrollLeft
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
    setSuggestedPrompts(pickSuggestedPrompts(sensitiveMode, surface))
  }

  if (!isOpen) return null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-2xl"
      ariaLabel="ASK AI"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent-ink" />
          ASK AI
        </span>
      }
      headerActions={
        <>
          {(hasConversation || messages.length > 0) && (
            <Button variant="tertiary"
              type="button"
              onClick={() => void handleNewChat()}
              disabled={isResetting}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer sm:min-h-9"
              title="Start a new chat (clears history)"
              aria-label="Start a new chat"
            >
              <SquarePen className="size-3.5" />
              <span>{isResetting ? 'Clearing…' : 'New chat'}</span>
            </Button>
          )}
          <IconButton
            type="button"
            onClick={handleClose}
            className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer sm:size-9"
            tooltip="Close"
            label="Close Ask AI"
          >
            <X className="size-4" />
          </IconButton>
        </>
      }
    >
      {/* `vh` does not shrink for the on-screen keyboard but the sheet's own max-height does
          (`.sheet-panel` measures `--app-vvh`), so a fixed 55vh made the conversation taller than
          the sheet holding it the moment the input was focused. Taking the smaller of the two keeps
          the same height with no keyboard and shrinks to what is actually visible with one. */}
      <div className="flex h-[min(55vh,calc(var(--app-vvh,100dvh)-13rem))] min-h-[220px] flex-col gap-3 sm:h-[480px]">
        {historyRedacted && (
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Earlier replies are hidden while sensitive mode is active.
          </p>
        )}
        {/* A stopped question may still have been answered and saved on the server. Asking again
            replays it, which is the only way to get back anything it prepared -- so keep the offer
            available even after later questions, with a free way out of it. */}
        {recoverableTurn && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1">
              A stopped question may already have been answered. Ask it again to get anything it prepared.
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 shrink-0 sm:min-h-0"
              disabled={isSending || isOffline || isHydrating || isResetting}
              onClick={recoverStoppedTurn}
            >
              <RotateCcw className="size-3" />
              Ask again
            </Button>
            <IconButton
              className="size-11 shrink-0 p-0 sm:size-7"
              onClick={dismissStoppedTurn}
              tooltip="Dismiss"
              label="Dismiss the stopped question"
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        )}
        {pendingActionBatches[0] && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1">
              {pendingActionBatches[0].actions.length === 1
                ? 'One AI-prepared review is waiting.'
                : `${pendingActionBatches[0].actions.length} AI-prepared reviews are waiting.`}
              {pendingActionBatches.length > 1 ? ` ${pendingActionBatches.length - 1} older batch${pendingActionBatches.length === 2 ? '' : 'es'} will remain.` : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 shrink-0 sm:min-h-0"
              disabled={isSending || isOffline || isHydrating || isResetting}
              onClick={() => void resumeActionBatch(pendingActionBatches[0])}
            >
              Resume review
            </Button>
            <IconButton
              className="size-11 shrink-0 p-0 sm:size-7"
              disabled={isSending || isOffline}
              onClick={() => void dismissActionBatch(pendingActionBatches[0].batchId)}
              tooltip="Dismiss prepared review"
              label="Dismiss prepared review"
            >
              <X className="size-3.5" />
            </IconButton>
          </div>
        )}
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {resetError}
            </div>
          )}
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
              <div className="mb-3 grid size-11 place-items-center rounded-xl border border-border/60 bg-muted/40 shadow-xs">
                <Sparkles className="size-5 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Ready.</p>
              {isOffline && <p className="mt-2 text-xs font-medium text-orange-500">Ask AI requires an internet connection.</p>}
              <div role="group" aria-label="Suggested questions" className="mt-4 flex w-full max-w-md flex-col items-center gap-2">
                {suggestedPrompts.map(prompt => (
                  <Button variant="tertiary"
                    key={prompt}
                    type="button"
                    disabled={isOffline}
                    onClick={() => setInput(prompt)}
                    className="min-h-11 w-auto max-w-full rounded-full border border-border/60 bg-background px-4 py-2 text-center text-xs leading-4 text-muted-foreground transition hover:border-primary/50 hover:text-foreground cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              <p className="mt-4 max-w-md text-xs leading-relaxed text-muted-foreground">
                Details go to the configured AI provider.
                {sensitiveMode ? ' Sensitive mode hides amounts and disables changes.' : ' Changes still need your confirmation.'}
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
                    <AiMessageContent content={message.content} accounts={accounts} role={message.role} />
                  </div>
                  {message.role === 'assistant' && index === messages.length - 1 && lastFailedTurn && (
                    <Button variant="tertiary"
                      type="button"
                      aria-label="Retry the last question"
                      onClick={() => void sendMessage(lastFailedTurn)}
                      className="mt-1 flex min-h-11 items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer sm:min-h-8"
                    >
                      <RotateCcw className="size-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
          {messages.length > 0 && <div ref={messagesEndRef} />}
          </div>
        </div>

        <form noValidate onSubmit={event => { event.preventDefault(); void sendMessage() }} className="relative flex items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          {mentions.isOpen && (
            <AccountMentionMenu
              accounts={mentions.options}
              activeIndex={mentions.activeIndex}
              onPick={mentions.pick}
              onHoverIndex={mentions.setActiveIndex}
            />
          )}
          <div className="relative min-w-0 flex-1">
            <div
              ref={composerHighlightRef}
              data-testid="ai-composer-highlight"
              aria-hidden="true"
              className="pointer-events-none absolute inset-px overflow-hidden whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-6 text-foreground"
            >
              <AccountMentionText content={input} accounts={accounts} style="composer" />
              {input.endsWith('\n') && '\u200b'}
            </div>
            <Textarea
              ref={textareaRef}
              aria-label="Ask AI"
              role="combobox"
              aria-expanded={mentions.isOpen}
              aria-controls={mentions.isOpen ? 'ai-account-mentions' : undefined}
              aria-activedescendant={mentions.activeAccountId ? `ai-account-mention-${mentions.activeAccountId}` : undefined}
              aria-autocomplete="list"
              disabled={isOffline || isHydrating || isResetting}
              value={input}
              onChange={e => mentions.handleChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              onSelect={mentions.syncCaret}
              onClick={mentions.syncCaret}
              onScroll={syncComposerScroll}
              onKeyDown={e => {
                // The picker owns the arrows and Enter only while it is open; every other moment
                // they belong to the message being typed.
                if (mentions.handleKeyDown(e)) return
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void sendMessage()
                }
              }}
              onKeyUp={mentions.syncCaret}
              placeholder={isOffline ? 'Ask AI is offline' : isHydrating ? 'Loading conversation…' : 'Ask about your finances…'}
              rows={1}
              className="relative z-10 min-h-11 max-h-40 w-full resize-none rounded-lg border border-transparent bg-transparent px-3 py-2.5 text-sm leading-6 text-transparent caret-foreground outline-hidden selection:bg-primary/25 focus:border-transparent focus:ring-0 focus:outline-hidden placeholder:text-muted-foreground"
            />
          </div>
          {/* While a turn is in flight the primary control becomes Stop, so a slow
              answer is never a dead end with a disabled button. */}
          <IconButton
            variant="primary"
            type={isSending ? 'button' : 'submit'}
            onClick={isSending ? () => cancelInFlight({ recoverable: true }) : undefined}
            disabled={isSending ? false : (!input.trim() || isOffline || isHydrating || isResetting)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl shadow-xs"
            tooltip={isSending ? 'Stop' : 'Send'}
            label={isSending ? 'Stop generating' : 'Send message'}
          >
            {isSending ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
          </IconButton>
        </form>
      </div>
    </BottomSheet>
  )
}
