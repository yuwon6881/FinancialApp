import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../lib/api/client'
import {
  chatWithAi,
  deleteAiConversation,
  fetchAiConversation,
  type AiChatMessage,
  type AiConversationState,
  type AiInvocationContext,
  type AiUiAction,
} from '../lib/api/ai'
import type { AiInvocationRequest } from '../app/useAiEntryPoint'
export type { AiInvocationRequest }

interface UseAiConversationOptions {
  isOpen: boolean
  onClose: () => void
  onActions: (actions: AiUiAction[]) => void | Promise<void>
  isOffline: boolean
  invocation: AiInvocationRequest | null
  onInvocationConsumed: () => void
}

interface FailedTurn {
  text: string
  clientTurnId: string
  context?: AiInvocationContext
}


const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

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
  invocation,
  onInvocationConsumed,
}: UseAiConversationOptions) {
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [historyRedacted, setHistoryRedacted] = useState(false)
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
    hydratedRef.current = true
  }, [])

  const hydrate = useCallback(async () => {
    if (isOffline) return null
    hydrationRequestRef.current?.abort()
    const controller = new AbortController()
    hydrationRequestRef.current = controller
    setIsHydrating(true)
    try {
      const snapshot = await fetchAiConversation(controller.signal)
      if (!controller.signal.aborted) applySnapshot(snapshot)
      return snapshot
    } finally {
      if (hydrationRequestRef.current === controller) {
        hydrationRequestRef.current = null
        setIsHydrating(false)
      }
    }
  }, [applySnapshot, isOffline])

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
    setMessages(current => [
      ...current,
      { role: 'assistant', content: 'Cancelled before the AI answered. Tap Retry to ask again.' },
    ])
  }, [])

  useEffect(() => {
    if (isOpen && !hydratedRef.current && !isOffline) {
      void hydrate().catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setResetError('The saved conversation could not be loaded. Close and reopen Ask AI to retry.')
        }
      })
    }
  }, [hydrate, isOffline, isOpen])

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
      await deleteAiConversation()
      conversationIdRef.current = null
      conversationVersionRef.current = 0
      conversationStateRef.current = null
      hydratedRef.current = true
      setMessages([])
      setHistoryRedacted(false)
      setInput('')
      setLastFailedTurn(null)
    } catch (error) {
      setResetError(`${describeChatError(error)} Your current conversation was kept.`)
    } finally {
      setIsResetting(false)
    }
  }, [cancelInFlight, isOffline])

  const sendMessage = useCallback(async (retry?: FailedTurn) => {
    const trimmed = (retry?.text ?? input).trim()
    if (!trimmed || isSending || isOffline || isHydrating || isResetting) return

    const baseMessages = retry ? messages.slice(0, -2) : messages
    const nextMessages: AiChatMessage[] = [...baseMessages, { role: 'user', content: trimmed }]
    const failedTurn = retry ?? { text: trimmed, clientTurnId: newClientTurnId() }
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
          conversationVersion: conversationVersionRef.current,
          clientTurnId: failedTurn.clientTurnId,
        },
        failedTurn.context,
      )
      if (generation !== requestGenerationRef.current) return
      pendingTurnRef.current = null
      conversationIdRef.current = result.conversationId ?? conversationIdRef.current
      conversationVersionRef.current = result.conversationVersion ?? conversationVersionRef.current
      conversationStateRef.current = result.state ?? null
      setHistoryRedacted(result.historyRedacted === true)
      setMessages([...nextMessages, { role: 'assistant', content: result.reply || 'Done.' }])
      if (result.actions.length > 0) {
        const requiresPanelClose = result.actions.some(action =>
          action.type.startsWith('openAdd') || action.type.startsWith('openEdit')
          || action.type.startsWith('request') || action.type === 'openLedgerExport'
          || action.type === 'toggleRecurring' || action.type === 'updateRecurringReminder')
        if (requiresPanelClose) {
          onClose()
          await nextFrame()
          await onActions(result.actions)
          return
        }

        await onActions(result.actions)
        if (result.closeChat) onClose()
      }
    } catch (error) {
      if (controller.signal.aborted || generation !== requestGenerationRef.current) return
      console.warn('Ask AI request failed', error)
      pendingTurnRef.current = null
      setLastFailedTurn(failedTurn)
      if (error instanceof ApiError && error.status === 409) {
        try {
          const snapshot = await fetchAiConversation(controller.signal)
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
    applySnapshot,
    input,
    isHydrating,
    isOffline,
    isResetting,
    isSending,
    messages,
    onActions,
    onClose,
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

  return {
    messages,
    input,
    setInput,
    isSending,
    isHydrating,
    isResetting,
    lastFailedTurn,
    resetError,
    historyRedacted,
    sendMessage,
    newChat,
    cancelInFlight,
  }
}
