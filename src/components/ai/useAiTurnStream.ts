import { useCallback, useState } from 'react'
import type { AiStreamHandlers } from '../../lib/api/aiStream'

export interface AiPendingReply {
  // What the assistant is doing right now ("Searching your transactions for “haircut”"),
  // or null before its first lookup.
  status: string | null
  // Reply text as it streams in. Provisional: the finished answer replaces it.
  text: string
}

const EMPTY: AiPendingReply = { status: null, text: '' }

// Live state of the turn in flight. isCurrent lets the caller drop events from a turn it has
// already abandoned (stopped, superseded, or cleared by sensitive mode).
export function useAiTurnStream() {
  const [pendingReply, setPendingReply] = useState<AiPendingReply>(EMPTY)

  const clear = useCallback(() => setPendingReply(EMPTY), [])

  const handlersFor = useCallback((isCurrent: () => boolean): AiStreamHandlers => ({
    onStatus: label => { if (isCurrent()) setPendingReply(current => ({ ...current, status: label })) },
    onDelta: text => { if (isCurrent()) setPendingReply(current => ({ ...current, text: current.text + text })) },
    onReset: () => { if (isCurrent()) setPendingReply(current => ({ ...current, text: '' })) },
  }), [])

  return { pendingReply, clear, handlersFor }
}
