import { useReducer, useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { transactionFormReducer, getInitialState, type SelectableLedgerCategory, type TransferBucket } from './transactionFormReducer'
import { getTodayDateString, mapFormToTransaction } from './transactionFormMapping'
import { validateTransactionForm } from './transactionFormValidation'
import { useTransactionSuggestions } from './useTransactionSuggestions'
import { useReceiptScanDraft } from './useReceiptScanDraft'
import { useFormDraft } from '../../../lib/useFormDraft'
import { useAutoOpenModal } from '../../../lib/useAutoOpenModal'
import type {
  Transaction,
  TransactionCategory,
  AutocompleteSuggestion,
  TransactionDocumentChanges,
  VaultDocument,
} from '../../../types'
import type { StabilityRecovery } from '../../../types'
import { proposeTopUp } from '../../../lib/stabilityRecovery'
import type { TransactionPrefillDraft } from '../TransactionFormSheet'
import type { TransactionDocumentsFieldRef } from './TransactionDocumentsField'
import { focusFirstInvalidField } from '../../ui/formValidation'
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
  /** Absent when the selected cycle is not the current one — a backdated salary gets no offer. */
  stabilityRecovery?: StabilityRecovery
  essentialsBalance?: number
  growthBalance?: number
  rewardsBalance?: number
  onAddTransaction: (
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<string | void> | string | void
  onUpdateTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<void> | void
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
    stabilityRecovery,
    essentialsBalance = 0,
    growthBalance = 0,
    rewardsBalance = 0,
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
  const documentsFieldRef = useRef<TransactionDocumentsFieldRef>(null)
  const [existingDocuments, setExistingDocuments] = useState<VaultDocument[]>([])

  useEffect(() => {
    descriptionRef.current = state.description
  }, [state.description])

  const openTransactionForm = useCallback(() => {
    dispatch({ type: 'SET_FIELD', field: 'showAddForm', value: true })
  }, [])

  // Only income can carry a top-up: it is the one entry that divides money four ways. All the
  // arithmetic lives in lib/stabilityRecovery so it stays testable without rendering.
  const topUpOffer = useMemo(() => {
    if (state.transactionType !== 'inflow' || state.ledgerCategory !== 'Income') return null
    const amount = parseFloat(state.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null

    return proposeTopUp(stabilityRecovery, Math.abs(amount), [
      { bucket: 'Essentials', alloc: essentialsAlloc, balance: essentialsBalance, committed: stabilityRecovery?.essentialsCommitted ?? 0 },
      { bucket: 'Growth', alloc: growthAlloc, balance: growthBalance, committed: 0 },
      { bucket: 'Rewards', alloc: rewardsAlloc, balance: rewardsBalance, committed: stabilityRecovery?.rewardsCommitted ?? 0 },
    ])
  }, [
    state.transactionType,
    state.ledgerCategory,
    state.amount,
    stabilityRecovery,
    essentialsAlloc,
    growthAlloc,
    rewardsAlloc,
    essentialsBalance,
    growthBalance,
    rewardsBalance,
  ])

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
      s.txType === state.transactionType &&
      !s.ledgerCategory.toLowerCase().startsWith('transfer:income->') &&
      !s.description.toLowerCase().startsWith('purchased:') &&
      !s.description.toLowerCase().endsWith('(wish list)')
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
    setExistingDocuments([])
    void import('../../../lib/api/documents')
      .then(({ listAllDocumentsForTransaction }) => listAllDocumentsForTransaction(t.id))
      .then(setExistingDocuments)
      .catch(() => onShowAlert?.('Attached documents could not be loaded.', 'Document Vault'))
    openTransactionForm()
  }, [hideSensitive, suggestions, onStartEditPending, onShowAlert, openTransactionForm])

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
    setExistingDocuments([])
    documentsFieldRef.current?.reset()
    dispatch({ type: 'OPEN_CREATE', payload: { defaultCategory, todayDate } })
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }

  const openWithDraft = (draft: TransactionPrefillDraft) => {
    setExistingDocuments([])
    documentsFieldRef.current?.reset()
    dispatch({ type: 'OPEN_CREATE', payload: { defaultCategory, todayDate } })
    dispatch({
      type: 'APPLY_RECEIPT',
      payload: {
        description: draft.description,
        amount: Math.abs(draft.amount).toFixed(2),
        date: draft.date ?? todayDate,
        category: draft.category || defaultCategory,
        ledgerCategory: draft.ledgerCategory && ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(draft.ledgerCategory)
          ? draft.ledgerCategory as SelectableLedgerCategory
          : undefined,
        txType: draft.txType,
      },
      todayDate,
    })
    descriptionRef.current = draft.description
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
    documentsFieldRef.current?.reset()
    setExistingDocuments([])
    dispatch({ type: 'CLOSE' })
    clearFormDraft()
    suggestions.clearSuggestions()
    scanner.clearScan()
    if (state.editingId && onStartEditPending) {
      onStartEditPending(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      focusFirstInvalidField(e.currentTarget)
      return
    }

    const documentValidationError = documentsFieldRef.current?.getValidationError()
    if (documentValidationError) {
      // TransactionDocumentsField already renders the missing-category or
      // category-load message inline. Keep validation feedback in the sheet so
      // a submit cannot produce a notification behind its own backdrop.
      focusFirstInvalidField(e.currentTarget)
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
      recoveryTopUp: state.stabilityTopUpAccepted ? (topUpOffer?.proposedTopUp ?? 0) : 0,
    })

    const documentChanges = documentsFieldRef.current?.getChanges()

    if (state.mode === 'edit' && state.editingId) {
      const targetId = state.editingId
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      scanner.clearScan()
      await onUpdateTransaction?.(targetId, mapped, documentChanges)
    } else {
      await onAddTransaction(mapped, documentChanges)
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      scanner.clearScan()
    }

    documentsFieldRef.current?.reset()
  }

  return {
    state,
    dispatch,
    firstInputRef,
    descriptionRef,
    autocompletedDescriptionRef,
    openFresh,
    openWithDraft,
    handleCloseForm,
    handleStartEdit,
    handleSubmit,
    changeTransactionType,
    scanner,
    suggestions,
    filteredSuggestions,
    quickSuggestionEntries,
    handleSelectSuggestion,
    documentsFieldRef,
    existingDocuments,
    topUpOffer,
  }
}
