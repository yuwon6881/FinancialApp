import { useState, useRef, useCallback, useEffect } from 'react'
import { suggestTransactionCategories, suggestTransactionNotes, type CategorySuggestion, type TransactionNoteSuggestion } from '../../../lib/api'

export interface UseTransactionSuggestionsOptions {
  categories: any[]
  editingTxId: string | null
  showAddForm: boolean
  txType: 'inflow' | 'outflow' | 'transfer'
  activeSuggestionEntries: any[]
  category: string
  ledgerCategory: string
}

export function useTransactionSuggestions(options: UseTransactionSuggestionsOptions) {
  const { categories, editingTxId, showAddForm, txType, activeSuggestionEntries, category, ledgerCategory } = options

  const [categorySuggestions, setCategorySuggestions] = useState<CategorySuggestion[]>([])
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false)
  const [categorySuggestionUnavailable, setCategorySuggestionUnavailable] = useState(false)

  const [noteSuggestions, setNoteSuggestions] = useState<TransactionNoteSuggestion[]>([])
  const [showNoteSuggestions, setShowNoteSuggestions] = useState(false)
  const [isSuggestingNote, setIsSuggestingNote] = useState(false)
  const [noteSuggestionUnavailable, setNoteSuggestionUnavailable] = useState(false)

  const categorySuggestionAbortRef = useRef<AbortController | null>(null)
  const categorySuggestionRequestSeqRef = useRef(0)
  const lastCategorySuggestionKeyRef = useRef<string | null>(null)

  const noteSuggestionAbortRef = useRef<AbortController | null>(null)
  const noteSuggestionRequestSeqRef = useRef(0)

  const clearSuggestions = useCallback(() => {
    setCategorySuggestions([])
    setCategorySuggestionUnavailable(false)
    setNoteSuggestions([])
    setShowNoteSuggestions(false)
    setIsSuggestingCategory(false)
    setIsSuggestingNote(false)
    setNoteSuggestionUnavailable(false)
    lastCategorySuggestionKeyRef.current = null
    categorySuggestionAbortRef.current?.abort()
    noteSuggestionAbortRef.current?.abort()
  }, [])

  const requestCategorySuggestions = useCallback(async (trimmedDescription: string, autocompletedDescription: string | null) => {
    if (
      !showAddForm ||
      editingTxId ||
      txType === 'transfer' ||
      trimmedDescription.length < 2 ||
      categories.length === 0 ||
      (autocompletedDescription && autocompletedDescription.trim() === trimmedDescription)
    ) {
      return
    }

    const categoryNames = categories.map(c => c.name).filter(Boolean)
    const requestKey = JSON.stringify([trimmedDescription.toLowerCase(), txType, categoryNames])
    if (lastCategorySuggestionKeyRef.current === requestKey) return
    lastCategorySuggestionKeyRef.current = requestKey

    categorySuggestionAbortRef.current?.abort()
    const controller = new AbortController()
    categorySuggestionAbortRef.current = controller
    const requestSeq = categorySuggestionRequestSeqRef.current + 1
    categorySuggestionRequestSeqRef.current = requestSeq
    setIsSuggestingCategory(true)
    setCategorySuggestionUnavailable(false)

    try {
      const suggestions = await suggestTransactionCategories({
        description: trimmedDescription,
        txType,
        categories: categoryNames,
      }, controller.signal)

      if (categorySuggestionRequestSeqRef.current !== requestSeq) return
      setCategorySuggestions(suggestions)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (categorySuggestionRequestSeqRef.current === requestSeq) {
        setCategorySuggestions([])
        setCategorySuggestionUnavailable(true)
        lastCategorySuggestionKeyRef.current = null
      }
      console.warn('Failed to suggest transaction categories', err)
    } finally {
      if (categorySuggestionRequestSeqRef.current === requestSeq) {
        setIsSuggestingCategory(false)
      }
    }
  }, [categories, editingTxId, showAddForm, txType])

  const requestNoteSuggestions = useCallback(async (trimmedDescription: string) => {
    if (!showAddForm || txType === 'transfer' || trimmedDescription.length < 2) return

    noteSuggestionAbortRef.current?.abort()
    const controller = new AbortController()
    noteSuggestionAbortRef.current = controller
    const requestSeq = noteSuggestionRequestSeqRef.current + 1
    noteSuggestionRequestSeqRef.current = requestSeq

    setShowNoteSuggestions(true)
    setIsSuggestingNote(true)
    setNoteSuggestionUnavailable(false)

    try {
      const suggestions = await suggestTransactionNotes({
        description: trimmedDescription,
        category,
        ledgerCategory,
        txType,
        historyDescriptions: activeSuggestionEntries
          .map(s => s.description?.trim())
          .filter((d): d is string => !!d)
          .map(d => d.length > 150 ? d.slice(0, 150) : d)
          .slice(0, 10)
      }, controller.signal)

      if (noteSuggestionRequestSeqRef.current !== requestSeq) return
      setNoteSuggestions(suggestions)
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (noteSuggestionRequestSeqRef.current === requestSeq) {
        setNoteSuggestions([])
        setNoteSuggestionUnavailable(true)
      }
      console.warn('Failed to suggest transaction notes', err)
    } finally {
      if (noteSuggestionRequestSeqRef.current === requestSeq) {
        setIsSuggestingNote(false)
      }
    }
  }, [activeSuggestionEntries, category, ledgerCategory, showAddForm, txType])

  useEffect(() => {
    return () => {
      categorySuggestionAbortRef.current?.abort()
      noteSuggestionAbortRef.current?.abort()
    }
  }, [])

  return {
    categorySuggestions,
    isSuggestingCategory,
    categorySuggestionUnavailable,
    noteSuggestions,
    setNoteSuggestions,
    showNoteSuggestions,
    setShowNoteSuggestions,
    isSuggestingNote,
    setIsSuggestingNote,
    noteSuggestionUnavailable,
    requestCategorySuggestions,
    requestNoteSuggestions,
    clearSuggestions,
  }
}
