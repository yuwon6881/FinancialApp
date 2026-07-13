import { useReducer, useMemo, useCallback, useEffect, useRef } from 'react'
import { transactionFormReducer, getInitialState, type TransferBucket } from './transactionFormReducer'
import { getTodayDateString, mapFormToTransaction } from './transactionFormMapping'
import { validateTransactionForm } from './transactionFormValidation'
import { useTransactionSuggestions } from './useTransactionSuggestions'
import { useReceiptScanDraft } from './useReceiptScanDraft'
import { useFormDraft } from '../../../lib/useFormDraft'
import { useAutoOpenModal } from '../../../lib/useAutoOpenModal'
import type { Transaction, TransactionCategory, AutocompleteSuggestion } from '../../../types'

export interface UseTransactionFormOptions {
  categories: TransactionCategory[]
  currency: string
  hideSensitive: boolean
  autocompleteSuggestions: AutocompleteSuggestion[]
  transactions: Transaction[]
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  stabilityBalance: number
  stabilityTarget: number
  stabilityOverflowRedirect: string
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  onAddFormOpenChange?: (open: boolean) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  receiptScanDraft?: any
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  activeScanJobIds?: string[]
  failedScanJob?: any
  aiEditDraft?: any
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onShowAlert?: (message: string, title?: string) => void
}

export function useTransactionForm(options: UseTransactionFormOptions) {
  const {
    categories,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    stabilityBalance,
    stabilityTarget,
    stabilityOverflowRedirect,
    onAddTransaction,
    onUpdateTransaction,
    onStartEditPending,
    onAddFormOpenChange,
    autoOpenAddForm,
    onResetAutoOpen,
    receiptScanDraft,
    onReceiptScanStarted,
    onReceiptScanCleared,
    activeScanJobIds,
    failedScanJob,
    aiEditDraft,
    onAiEditDraftConsumed,
    onFetchTransactionById,
    onShowAlert,
    autocompleteSuggestions,
    transactions,
    hideSensitive,
  } = options

  const defaultCategory = categories.length > 0 ? categories[0].name : ''
  const todayDate = getTodayDateString()

  const [state, dispatch] = useReducer(transactionFormReducer, getInitialState(todayDate, defaultCategory))

  const firstInputRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef('')
  const autocompletedDescriptionRef = useRef<string | null>(null)

  useEffect(() => {
    descriptionRef.current = state.description
  }, [state.description])

  const openTransactionForm = useCallback(() => {
    dispatch({ type: 'SET_FIELD', field: 'showAddForm', value: true })
  }, [])

  const { clearDraft: clearFormDraft } = useFormDraft(
    'ledger-tx-form',
    state.showAddForm,
    {
      editingTxId: state.editingId,
      description: state.description,
      amount: state.amount,
      txType: state.transactionType,
      category: state.category,
      ledgerCategory: state.ledgerCategory,
      transferSource: state.transferSource,
      transferTarget: state.transferTarget,
      date: state.date
    },
    (draft) => {
      dispatch({
        type: 'OPEN_EDIT',
        payload: {
          id: draft.editingTxId || '',
          description: draft.description,
          amount: draft.amount,
          date: draft.date,
          category: draft.category,
          ledgerCategory: draft.ledgerCategory,
          txType: draft.txType,
          transferSource: draft.transferSource,
          transferTarget: draft.transferTarget,
        }
      })
      if (draft.editingTxId && onStartEditPending) {
        onStartEditPending(draft.editingTxId)
      }
      openTransactionForm()
    }
  )

  useEffect(() => {
    onAddFormOpenChange?.(state.showAddForm)
    return () => {
      onAddFormOpenChange?.(false)
    }
  }, [state.showAddForm, onAddFormOpenChange])

  // Receipt Scan results
  const applyReceiptScanResult = useCallback((result: any) => {
    dispatch({ type: 'APPLY_RECEIPT', payload: result, todayDate })
    window.setTimeout(() => {
      firstInputRef.current?.focus()
      firstInputRef.current?.select()
    }, 450)
  }, [todayDate])

  const scanner = useReceiptScanDraft({
    showAddForm: state.showAddForm,
    autoOpenAddForm,
    receiptScanDraft,
    activeScanJobIds,
    failedScanJob,
    onReceiptScanStarted,
    onReceiptScanCleared,
    applyReceiptScanResult,
    openTransactionForm,
    onStartEditPending,
  })

  // Suggestions setup
  const activeSuggestionEntries = useMemo(() => {
    if (state.transactionType === 'transfer') return []
    return autocompleteSuggestions.filter(s =>
      s.txType === state.transactionType && !s.ledgerCategory.toLowerCase().startsWith('transfer:income->')
    )
  }, [autocompleteSuggestions, state.transactionType])

  const suggestions = useTransactionSuggestions({
    categories,
    editingTxId: state.editingId,
    showAddForm: state.showAddForm,
    txType: state.transactionType,
    activeSuggestionEntries,
    category: state.category,
    ledgerCategory: state.ledgerCategory,
  })

  const filteredSuggestions = useMemo(() => {
    if (!state.description.trim() || state.description.trim().length < 1) return []
    const query = state.description.toLowerCase().trim()
    return activeSuggestionEntries
      .filter(s => s.description.toLowerCase().includes(query))
      .slice(0, 8)
  }, [state.description, activeSuggestionEntries])

  const quickSuggestionEntries = useMemo(() => {
    return activeSuggestionEntries.slice(0, 12)
  }, [activeSuggestionEntries])

  // Select suggestion
  const handleSelectSuggestion = useCallback((suggestion: any) => {
    descriptionRef.current = suggestion.description
    autocompletedDescriptionRef.current = suggestion.description.trim()
    dispatch({ type: 'SET_FIELD', field: 'description', value: suggestion.description })
    suggestions.clearSuggestions()

    if (state.transactionType !== 'transfer') {
      if (['Income', 'Essentials', 'Growth', 'Stability', 'Rewards'].includes(suggestion.ledgerCategory)) {
        dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: suggestion.ledgerCategory })
      }
      if (suggestion.category) {
        dispatch({ type: 'SET_FIELD', field: 'category', value: suggestion.category })
      }
    }
  }, [state.transactionType, suggestions])

  const handleStartEdit = useCallback((t: Transaction) => {
    if (hideSensitive) return
    dispatch({
      type: 'OPEN_EDIT',
      payload: {
        id: t.id,
        description: t.description,
        amount: Math.abs(t.amount).toFixed(2),
        date: t.date,
        category: t.category,
        ledgerCategory: t.ledgerCategory.startsWith('Transfer:') ? 'Essentials' : t.ledgerCategory,
        txType: t.ledgerCategory.startsWith('Transfer:') ? 'transfer' : (t.amount < 0 ? 'outflow' : 'inflow'),
        transferSource: t.ledgerCategory.startsWith('Transfer:') ? (t.ledgerCategory.substring(9).split('->')[0].trim() as TransferBucket) : undefined,
        transferTarget: t.ledgerCategory.startsWith('Transfer:') ? (t.ledgerCategory.substring(9).split('->')[1].trim() as TransferBucket) : undefined,
      }
    })
    descriptionRef.current = t.description
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    if (onStartEditPending) {
      onStartEditPending(t.id)
    }
    openTransactionForm()
  }, [hideSensitive, dispatch, descriptionRef, autocompletedDescriptionRef, suggestions, onStartEditPending, openTransactionForm])

  useEffect(() => {
    if (!aiEditDraft) return
    let cancelled = false
    const openAiEdit = async () => {
      let target = transactions.find(t => String(t.id) === String(aiEditDraft.id))
      if (!target && onFetchTransactionById) {
        try {
          target = await onFetchTransactionById(String(aiEditDraft.id))
        } catch {
          target = undefined
        }
      }
      if (cancelled) return
      if (!target) {
        onShowAlert?.('Could not find the transaction AI selected.', 'AI Edit Failed')
        onAiEditDraftConsumed?.()
        return
      }

      handleStartEdit(target)
      dispatch({ type: 'APPLY_AI_DRAFT', payload: { fields: aiEditDraft.changes }, todayDate })
      onAiEditDraftConsumed?.()
    }
    void openAiEdit()
    return () => {
      cancelled = true
    }
  }, [aiEditDraft?.nonce])

  // Cycle Category default side effects
  useEffect(() => {
    if (state.transactionType === 'inflow') {
      if (!state.editingId) {
        dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Income' })
        const hasSalary = categories.some(c => c.name === 'Salary')
        dispatch({ type: 'SET_FIELD', field: 'category', value: hasSalary ? 'Salary' : defaultCategory })
      } else if (state.ledgerCategory.startsWith('Transfer:')) {
        dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Income' })
      }
    } else if (state.transactionType === 'outflow') {
      if (state.ledgerCategory === 'Income' || state.ledgerCategory.startsWith('IncomeSplit:') || state.ledgerCategory.startsWith('Transfer:')) {
        dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: 'Essentials' })
      }
    }
  }, [state.transactionType, categories, state.editingId, defaultCategory])

  // Transfer text generator side effects
  useEffect(() => {
    if (state.transactionType === 'transfer' && !state.editingId) {
      dispatch({ type: 'SET_FIELD', field: 'description', value: `Transfer from ${state.transferSource} to ${state.transferTarget}` })
    }
  }, [state.transactionType, state.transferSource, state.transferTarget, state.editingId])

  useEffect(() => {
    if (categories.length > 0 && !state.category) {
      dispatch({ type: 'SET_FIELD', field: 'category', value: defaultCategory })
    }
  }, [categories, state.category, defaultCategory])

  useAutoOpenModal(autoOpenAddForm, openTransactionForm, onResetAutoOpen)

  const openFresh = () => {
    dispatch({ type: 'OPEN_CREATE', payload: { defaultCategory, todayDate } })
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }

  const changeTransactionType = (type: 'inflow' | 'outflow' | 'transfer') => {
    if (state.mode === 'create') {
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      dispatch({ type: 'SET_FIELD', field: 'showAddForm', value: true })
    }
    dispatch({ type: 'SET_FIELD', field: 'transactionType', value: type })
  }

  const handleCloseForm = () => {
    const scanJobToClear = scanner.activeReceiptScanJobId
    dispatch({ type: 'CLOSE' })
    clearFormDraft()
    suggestions.clearSuggestions()
    scanner.clearScan()
    if (state.editingId && onStartEditPending) {
      onStartEditPending(null)
    }
    if (scanJobToClear) {
      void onReceiptScanCleared?.(scanJobToClear)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validateTransactionForm({
      description: state.description,
      amount: state.amount,
      date: state.date,
      transactionType: state.transactionType,
      transferSource: state.transferSource,
      transferTarget: state.transferTarget,
    })

    if (Object.keys(validationErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: validationErrors })
      return
    }

    const mapped = mapFormToTransaction(state, {
      essentialsAlloc,
      growthAlloc,
      stabilityAlloc,
      rewardsAlloc,
      stabilityBalance,
      stabilityTarget,
      stabilityOverflowRedirect,
    })

    const scanJobToClear = scanner.activeReceiptScanJobId

    if (state.mode === 'edit' && state.editingId) {
      const targetId = state.editingId
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      if (scanJobToClear) {
        void onReceiptScanCleared?.(scanJobToClear)
      }
      await onUpdateTransaction?.(targetId, mapped)
    } else {
      await onAddTransaction(mapped)
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      if (scanJobToClear) {
        void onReceiptScanCleared?.(scanJobToClear)
      }
    }
  }

  return {
    state,
    dispatch,
    firstInputRef,
    descriptionRef,
    autocompletedDescriptionRef,
    openFresh,
    handleCloseForm,
    handleStartEdit,
    handleSubmit,
    changeTransactionType,
    scanner,
    suggestions,
    filteredSuggestions,
    quickSuggestionEntries,
    handleSelectSuggestion,
  }
}
