import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyAccountMention,
  findAccountMentionQuery,
  isAccountMentionComplete,
  matchAccountsForMention,
} from '../../lib/aiAccountMentions'
import type { LedgerAccount } from '../../types'

interface UseAccountMentionComposerOptions {
  input: string
  setInput: (value: string) => void
  accounts: LedgerAccount[]
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

/**
 * Composer state for "@account" mentions. The list is open only while the caret sits inside a
 * mention, so the arrow keys and Enter belong to the picker exactly then and to the message every
 * other moment -- Enter must never both pick an account and send the half-typed line.
 */
export function useAccountMentionComposer({
  input,
  setInput,
  accounts,
  textareaRef,
}: UseAccountMentionComposerOptions) {
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDismissed, setIsDismissed] = useState(false)
  // Set by a pick so the caret can be restored after React commits the new value.
  const pendingCaretRef = useRef<number | null>(null)

  const mention = useMemo(() => {
    if (isDismissed) return null
    const found = findAccountMentionQuery(input, caret)
    return found && isAccountMentionComplete(found.query, accounts) ? null : found
  }, [input, caret, isDismissed, accounts])
  const options = useMemo(
    () => (mention ? matchAccountsForMention(accounts, mention.query) : []),
    [mention, accounts],
  )
  const isOpen = mention !== null && options.length > 0

  useEffect(() => { setActiveIndex(0) }, [mention?.query, mention?.start])

  useEffect(() => {
    const target = pendingCaretRef.current
    if (target == null) return
    pendingCaretRef.current = null
    const element = textareaRef.current
    if (!element) return
    element.focus()
    element.setSelectionRange(target, target)
    setCaret(target)
  }, [input, textareaRef])

  const syncCaret = useCallback(() => {
    const element = textareaRef.current
    if (element) setCaret(element.selectionStart ?? element.value.length)
  }, [textareaRef])

  const handleChange = useCallback((value: string, nextCaret: number) => {
    setIsDismissed(false)
    setInput(value)
    setCaret(nextCaret)
  }, [setInput])

  const pick = useCallback((account: LedgerAccount) => {
    if (!mention) return
    const next = applyAccountMention(input, mention, account)
    pendingCaretRef.current = next.caret
    setInput(next.text)
  }, [input, mention, setInput])

  /** Returns true when the key was consumed by the picker and must not reach the composer. */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return false
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(current => (current + 1) % options.length)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(current => (current - 1 + options.length) % options.length)
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      pick(options[activeIndex] ?? options[0])
      return true
    }
    if (event.key === 'Escape') {
      // Closing the list must not also close the sheet the composer sits in.
      event.preventDefault()
      event.stopPropagation()
      setIsDismissed(true)
      return true
    }
    return false
  }, [activeIndex, isOpen, options, pick])

  return {
    isOpen,
    options,
    activeIndex,
    activeAccountId: isOpen ? options[activeIndex]?.id ?? null : null,
    setActiveIndex,
    handleChange,
    handleKeyDown,
    syncCaret,
    pick,
  }
}
