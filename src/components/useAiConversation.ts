import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api/client'
import {
  chatWithAi,
  deleteAiConversation,
  fetchAiConversation,
  resolveAiActionBatch,
  type AiActionBatch,
  type AiChatMessage,
  type AiConversationState,
  type AiInvocationContext,
  type AiUiAction,
} from '../lib/api/ai'
import { resolveAccountMentions } from '../lib/aiAccountMentions'
import type { LedgerAccount } from '../types'
import type { AiInvocationRequest } from '../app/useAiEntryPoint'
export type { AiInvocationRequest }

interface UseAiConversationOptions {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: AiUiAction[]) => void | Promise<void>
  isOffline: boolean
  sensitiveMode: boolean
  defaultContext: AiInvocationContext
  invocation: AiInvocationRequest | null
  onInvocationConsumed: () => void
  accounts: LedgerAccount[]
}

interface FailedTurn {
  text: string
  clientTurnId: string
  context?: AiInvocationContext
}


const newClientTurnId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}

const describeChatError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 423) return 'Your session ended. Sign in again to keep chatting.'
    if (error.status === 429) return 'Too many requests right now. Please wait a moment and try again.'
    if (error.status === 0 || error.status >= 500) return error.message || 'AI is unavailable. Please try again.'
    return error.message || 'AI could not handle that request.'
  }
  return 'AI is unavailable. Please check your connection and try again.'
}

export function useAiConversation({
  isOpen,
  onClose,
  onActions,
  isOffline,
  sensitiveMode,
  defaultContext,
  invocation,
  onInvocationConsumed,
  accounts,
}: UseAiConversationOptions) {
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null)
  // A stopped turn is not necessarily an abandoned one: the server may have finished and
  // committed it after we stopped listening, and replaying its clientTurnId is the only way to
  // get back the actions it produced -- the drafts it staged included, since a rehydrated
  // conversation carries messages but never actions. lastFailedTurn cannot hold this, because
  // it is bound to the last message on screen and the next question clears it.
  const [recoverableTurn, setRecoverableTurn] = useState<FailedTurn | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [historyRedacted, setHistoryRedacted] = useState(false)
  const [pendingActionBatches, setPendingActionBatches] = useState<AiActionBatch[]>([])
  const [hasConversation, setHasConversation] = useState(false)
  const conversationIdRef = useRef<string | null>(null)
  const conversationVersionRef = useRef(0)
  const conversationStateRef = useRef<AiConversationState | null>(null)
  const hydratedRef = useRef(false)
  const activeRequestRef = useRef<AbortController | null>(null)
  const hydrationRequestRef = useRef<AbortController | null>(null)
  const requestGenerationRef = useRef(0)
  const pendingTurnRef = useRef<FailedTurn | null>(null)
  const consumedInvocationRef = useRef<number | null>(null)

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof fetchAiConversation>>) => {
    conversationIdRef.current = snapshot.conversationId
    conversationVersionRef.current = snapshot.conversationVersion
    conversationStateRef.current = snapshot.state
    setMessages(snapshot.messages)
    setHistoryRedacted(snapshot.historyRedacted === true)
    setPendingActionBatches(snapshot.pendingActionBatches ?? [])
    setHasConversation(snapshot.conversationId !== null)
    hydratedRef.current = true
  }, [])

  const hydrate = useCallback(async () => {
    if (isOffline) return null
    hydrationRequestRef.current?.abort()
    const controller = new AbortController()
    hydrationRequestRef.current = controller
    setIsHydrating(true)
    try {
      const snapshot = await fetchAiConversation(sensitiveMode, controller.signal)
      if (!controller.signal.aborted) {
        setResetError(null)
        applySnapshot(snapshot)
      }
      return snapshot
    } finally {
      if (hydrationRequestRef.current === controller) {
        hydrationRequestRef.current = null
        setIsHydrating(false)
      }
    }
  }, [applySnapshot, isOffline, sensitiveMode])

  const cancelInFlight = useCallback((options: { recoverable?: boolean } = {}) => {
    const wasSending = activeRequestRef.current !== null
    requestGenerationRef.current += 1
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setIsSending(false)
    const pending = pendingTurnRef.current
    pendingTurnRef.current = null
    if (!wasSending || !options.recoverable || !pending) return
    setLastFailedTurn(pending)
    setRecoverableTurn(pending)
    setMessages(current => [
      ...current,
      { role: 'assistant', content: 'Cancelled before the AI answered. Tap Retry to ask again.' },
    ])
  }, [])

  useEffect(() => {
    if (isOpen && !isOffline) {
      hydratedRef.current = false
      if (sensitiveMode) {
        setMessages([])
        setHistoryRedacted(true)
      }
      void hydrate().catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResetError('The saved conversation could not be loaded. Close and reopen Ask AI to retry.')
        }
      })
    }
  }, [hydrate, isOffline, isOpen, sensitiveMode])

  useEffect(() => {
    if (!sensitiveMode) return
    cancelInFlight({ recoverable: true })
  }, [cancelInFlight, sensitiveMode])

  useEffect(() => {
    if (!isOpen) cancelInFlight({ recoverable: true })
  }, [cancelInFlight, isOpen])

  useEffect(() => {
    if (isOffline) cancelInFlight({ recoverable: true })
  }, [cancelInFlight, isOffline])

  useEffect(() => () => {
    activeRequestRef.current?.abort()
    hydrationRequestRef.current?.abort()
  }, [])

  const newChat = useCallback(async () => {
    if (isOffline) {
      setResetError('Reconnect before starting a new chat. Your current conversation was kept.')
      return
    }
    cancelInFlight()
    setIsResetting(true)
    setResetError(null)
    try {
      await deleteAiConversation(
        conversationIdRef.current,
        conversationIdRef.current ? conversationVersionRef.current : null,
      )
      conversationIdRef.current = null
      conversationVersionRef.current = 0
      conversationStateRef.current = null
      hydratedRef.current = true
      setMessages([])
      setHistoryRedacted(false)
      setInput('')
      setLastFailedTurn(null)
      setRecoverableTurn(null)
      setPendingActionBatches([])
      setHasConversation(false)
    } catch (error) {
      setResetError(`${describeChatError(error)} Your current conversation was kept.`)
    } finally {
      setIsResetting(false)
    }
  }, [cancelInFlight, isOffline])

  const sendMessage = useCallback(async (retry?: FailedTurn) => {
    const trimmed = (retry?.text ?? input).trim()
    if (!trimmed || isSending || isOffline || isHydrating || isResetting) return

    // Retrying the exchange still on screen replaces it. Recovering an older stopped turn, or
    // running a contextual invocation against a hydrated history, must append instead -- both
    // arrive as a prepared turn too, and blindly dropping the last two messages would delete a
    // completed exchange from the transcript.
    const tail = messages.slice(-2)
    const replacesLastExchange = retry != null && tail.length === 2 &&
      tail[0].role === 'user' && tail[0].content === trimmed && tail[1].role === 'assistant'
    const baseMessages = replacesLastExchange ? messages.slice(0, -2) : messages
    const nextMessages: AiChatMessage[] = [...baseMessages, { role: 'user', content: trimmed }]
    const failedTurn = retry ?? { text: trimmed, clientTurnId: newClientTurnId(), context: defaultContext }
    setResetError(null)
    setLastFailedTurn(null)
    setMessages(nextMessages)
    setInput('')
    setIsSending(true)
    const generation = requestGenerationRef.current + 1
    requestGenerationRef.current = generation
    const controller = new AbortController()
    activeRequestRef.current?.abort()
    activeRequestRef.current = controller
    pendingTurnRef.current = failedTurn

    try {
      const result = await chatWithAi(
        trimmed,
        baseMessages,
        conversationStateRef.current,
        controller.signal,
        {
          conversationId: conversationIdRef.current,
          conversationVersion: conversationIdRef.current ? conversationVersionRef.current : null,
          clientTurnId: failedTurn.clientTurnId,
        },
        failedTurn.context,
        sensitiveMode,
        // Resolved from the message itself rather than kept as separate state, so a mention the
        // user edited back out of the text is not still sent as a named account.
        resolveAccountMentions(trimmed, accounts),
      )
      if (generation !== requestGenerationRef.current) return
      pendingTurnRef.current = null
      // This turn is answered, so it is no longer waiting to be recovered. A failure leaves the
      // handle in place instead, so a failed recovery can be tried again.
      setRecoverableTurn(current => current?.clientTurnId === failedTurn.clientTurnId ? null : current)
      conversationIdRef.current = result.conversationId ?? conversationIdRef.current
      setHasConversation(conversationIdRef.current !== null)
      conversationVersionRef.current = result.conversationVersion ?? conversationVersionRef.current
      conversationStateRef.current = result.state ?? null
      setHistoryRedacted(result.historyRedacted === true)
      setMessages([...nextMessages, { role: 'assistant', content: result.reply || 'Done.' }])
      if (result.actionBatch) {
        setPendingActionBatches(current => [
          ...current.filter(batch => batch.batchId !== result.actionBatch!.batchId),
          result.actionBatch!,
        ])
      }
      if (result.actions.length > 0) {
        const requiresPanelClose = result.actions.some(action =>
          action.type.startsWith('openAdd') || action.type.startsWith('openEdit')
          || action.type.startsWith('request') || action.type === 'openLedgerExport'
          || action.type === 'toggleRecurring' || action.type === 'updateRecurringReminder')
        await onActions(result.actions)
        if (result.actionBatch) {
          try {
            await resolveAiActionBatch(result.actionBatch.batchId, 'accepted')
            setPendingActionBatches(current => current.filter(batch => batch.batchId !== result.actionBatch!.batchId))
          } catch (error) {
            console.warn('AI action was delivered but its receipt could not be saved', error)
            setResetError('The draft opened, but its AI delivery status could not be saved. Dismiss the pending review after checking it.')
          }
        }
        if (requiresPanelClose || result.closeChat) onClose()
      } else if (result.closeChat) {
        onClose()
      }
    } catch (error) {
      if (controller.signal.aborted || generation !== requestGenerationRef.current) return
      console.warn('Ask AI request failed', error)
      pendingTurnRef.current = null
      setLastFailedTurn(failedTurn)
      if (!(error instanceof ApiError) || error.status === 0 || error.status === 504 || error.status >= 500) {
        setRecoverableTurn(failedTurn)
      }
      if (error instanceof ApiError && error.status === 409) {
        try {
          const snapshot = await fetchAiConversation(sensitiveMode, controller.signal)
          if (generation !== requestGenerationRef.current) return
          applySnapshot(snapshot)
          setMessages([
            ...snapshot.messages,
            { role: 'user', content: trimmed },
            { role: 'assistant', content: 'The conversation changed on another device. Tap Retry to send this message against the latest conversation.' },
          ])
        } catch (reloadError) {
          if (!controller.signal.aborted) {
            setMessages([...nextMessages, { role: 'assistant', content: describeChatError(reloadError) }])
          }
        }
      } else {
        setMessages([...nextMessages, { role: 'assistant', content: describeChatError(error) }])
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        activeRequestRef.current = null
        pendingTurnRef.current = null
        setIsSending(false)
      }
    }
  }, [
    accounts,
    applySnapshot,
    defaultContext,
    input,
    isHydrating,
    isOffline,
    isResetting,
    isSending,
    messages,
    onActions,
    onClose,
    sensitiveMode,
  ])

  useEffect(() => {
    if (!invocation || !isOpen || isOffline || isHydrating || isResetting || !hydratedRef.current) return
    if (consumedInvocationRef.current === invocation.nonce) return
    consumedInvocationRef.current = invocation.nonce
    onInvocationConsumed()
    void sendMessage({
      text: invocation.prompt,
      clientTurnId: invocation.clientTurnId ?? newClientTurnId(),
      context: invocation.context,
    })
  }, [invocation, isHydrating, isOffline, isOpen, isResetting, onInvocationConsumed, sendMessage])

  const recoverStoppedTurn = useCallback(() => {
    if (recoverableTurn) void sendMessage(recoverableTurn)
  }, [recoverableTurn, sendMessage])

  const dismissStoppedTurn = useCallback(() => setRecoverableTurn(null), [])

  const resumeActionBatch = useCallback(async (batch: AiActionBatch) => {
    if (isOffline || isSending) return
    setIsSending(true)
    setResetError(null)
    try {
      await onActions(batch.actions)
      await resolveAiActionBatch(batch.batchId, 'accepted')
      setPendingActionBatches(current => current.filter(candidate => candidate.batchId !== batch.batchId))
      onClose()
    } catch (error) {
      setResetError(describeChatError(error))
    } finally {
      setIsSending(false)
    }
  }, [isOffline, isSending, onActions, onClose])

  const dismissActionBatch = useCallback(async (batchId: string) => {
    if (isOffline || isSending) return
    setResetError(null)
    try {
      await resolveAiActionBatch(batchId, 'dismissed')
      setPendingActionBatches(current => current.filter(batch => batch.batchId !== batchId))
    } catch (error) {
      setResetError(describeChatError(error))
    }
  }, [isOffline, isSending])

  return {
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
    historyRedacted,
    hasConversation,
    pendingActionBatches,
    resumeActionBatch,
    dismissActionBatch,
    sendMessage,
    newChat,
    cancelInFlight,
  }
}
