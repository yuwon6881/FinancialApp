import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildSearchResults, groupSearchResults, visibleSearchResults, type SearchResult, type SearchSourceData } from '../../lib/search/searchSources'

export interface UseGlobalSearchOptions {
  isOpen: boolean
  data: SearchSourceData
  /** False while sensitive mode is on, so a query cannot probe a masked amount. */
  includeAmounts: boolean
  onClose: () => void
  onOpenResult: (result: SearchResult) => void
  /** Hands the raw query to the Ledger's all-cycles search. */
  onSearchAllCycles: (query: string) => void
}

export function useGlobalSearch({
  isOpen,
  data,
  includeAmounts,
  onClose,
  onOpenResult,
  onSearchAllCycles,
}: UseGlobalSearchOptions) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Whatever had focus when search opened, so closing returns the user where they were instead
  // of dropping focus to the document body.
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const matched = useMemo(
    () => buildSearchResults(data, query, { includeAmounts }),
    [data, query, includeAmounts],
  )
  const groups = useMemo(() => groupSearchResults(matched), [matched])
  // The per-kind cap is applied by grouping, so the rendered rows -- not every match -- are what
  // keyboard selection and the footer count read from.
  const results = useMemo(() => visibleSearchResults(groups), [groups])
  const totalMatched = matched.length

  const trimmedQuery = query.trim()
  const canSearchAllCycles = trimmedQuery.length > 0

  /**
   * The all-cycles handoff is the last selectable row, so Enter reaches it by keyboard like any
   * result. It is represented as `null` rather than a synthetic result: it navigates instead of
   * opening a record, and giving it a fake target would put it through `onOpenResult`.
   */
  const selectable = useMemo<Array<SearchResult | null>>(
    () => (canSearchAllCycles ? [...results, null] : [...results]),
    [results, canSearchAllCycles],
  )

  useEffect(() => {
    if (!isOpen) return
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setActiveIndex(0)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [isOpen])

  const close = useCallback((shouldRestoreFocus = true) => {
    onClose()
    const restoreTo = restoreFocusRef.current
    restoreFocusRef.current = null
    if (shouldRestoreFocus && restoreTo?.isConnected) {
      restoreTo.focus({ preventScroll: true })
    } else {
      restoreTo?.blur?.()
    }
  }, [onClose])

  /**
   * Escape is bound to the document, not to the panel, because the panel's own handler only sees
   * a key pressed while focus is already inside it — and focus arrives a frame after mount, so an
   * Escape pressed the instant search opened did nothing at all. A modal has to close on Escape
   * whatever has focus.
   */
  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isOpen, close])

  // Keep the active row addressable after the list shrinks under a longer query.
  useEffect(() => {
    setActiveIndex(current => (current >= selectable.length ? Math.max(0, selectable.length - 1) : current))
  }, [selectable.length])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    active?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex])

  const openIndex = useCallback((index: number) => {
    const target = selectable[index]
    if (target === undefined) return
    if (target === null) {
      onSearchAllCycles(trimmedQuery)
    } else {
      onOpenResult(target)
    }
    close(false)
  }, [selectable, onSearchAllCycles, onOpenResult, trimmedQuery, close])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Escape is deliberately absent here: the document listener above owns it, so it works
    // before focus has reached the panel too. Handling it in both places closed twice.
    if (event.key === 'Tab') {
      // A modal must not leak focus to the page behind it. The panel holds few focusables and
      // arrow keys already drive the list, so the trap simply keeps focus on the input.
      event.preventDefault()
      inputRef.current?.focus()
      return
    }
    if (selectable.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(current => (current + 1) % selectable.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(current => (current - 1 + selectable.length) % selectable.length)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(selectable.length - 1)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      openIndex(activeIndex)
    }
  }, [selectable.length, activeIndex, openIndex])

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setActiveIndex(0)
  }, [])

  /** Stable per-row DOM id, so `aria-activedescendant` can name the active option. */
  const optionId = useCallback((index: number) => `global-search-option-${index}`, [])

  const indexOfResult = useCallback(
    (result: SearchResult) => results.findIndex(candidate => candidate.id === result.id),
    [results],
  )

  return {
    query,
    updateQuery,
    results,
    groups,
    totalMatched,
    activeIndex,
    setActiveIndex,
    selectableCount: selectable.length,
    canSearchAllCycles,
    allCyclesIndex: canSearchAllCycles ? selectable.length - 1 : -1,
    trimmedQuery,
    inputRef,
    listRef,
    panelRef,
    handleKeyDown,
    openIndex,
    close,
    optionId,
    indexOfResult,
  }
}
