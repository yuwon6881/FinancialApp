import { useReducer, useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { transactionFormReducer, getInitialState, type SelectableLedgerCategory, type TransferBucket } from './transactionFormReducer'
import { getTodayDateString } from './transactionFormMapping'
import { useTransactionSuggestions } from './useTransactionSuggestions'
import { useReceiptScanDraft } from './useReceiptScanDraft'
import { useFormDraft } from '../../../lib/useFormDraft'
import { useAutoOpenModal } from '../../../lib/useAutoOpenModal'
import type {
  Transaction,
  TransactionDocumentChanges,
  VaultDocument,
} from '../../../types'
import { useStabilityTopUpOffer } from './useStabilityTopUpOffer'
import type { TransactionDocumentsFieldRef } from './TransactionDocumentsField'
import type { ReceiptScanResult } from '../../../lib/api'
import type { UseTransactionFormOptions } from './useTransactionFormOptions'
import { isSelectableTransactionCategory } from '../../../lib/categoryFlow'
import { useTransactionFormAccountEffects } from './useTransactionFormAccountEffects'
import { useTransactionOutflowWarning } from './useTransactionOutflowWarning'
import { useTransactionFormLifecycle } from './useTransactionFormLifecycle'
import { useTransactionFormSubmit } from './useTransactionFormSubmit'

export type { UseTransactionFormOptions } from './useTransactionFormOptions'

export function useTransactionForm(options: UseTransactionFormOptions) {
  const {
    categories,
    accounts: accountsInput,
    accountsLoading = accountsInput === undefined,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    cycleDay,
    selectedMonth,
    selectedYear,
    stabilityBalance,
    stabilityTarget,
    stabilityOverflowRedirect,
    stabilityTopUpContext,
    onAddTransaction,
    onUpdateTransaction,
    onUpdateDraftTransaction,
    onLoadDraftDocumentChanges,
    onStartEditPending,
    onAddFormOpenChange,
    autoOpenAddForm,
    autoOpenTxType,
    autoOpenPrefill,
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
    onOutsideCycleSave,
    autocompleteSuggestions,
    transactions,
    hideSensitive,
    sensitivePreferenceStatus,
  } = options
  const accounts = accountsInput ?? []

  const deriveIncomeSplitAccountIds = useCallback((transaction: Transaction) => {
    if (transaction.ledgerCategory !== 'Income') return transaction.splitAccountIds
    const derived: Partial<Record<TransferBucket, string>> = {}
    for (const bucket of ['Essentials', 'Growth', 'Stability', 'Rewards'] as const) {
      const split = transactions.find(candidate => candidate.id === `${transaction.id}-split-${bucket}`)
      if (split?.accountId) derived[bucket] = split.accountId
    }
    return derived
  }, [transactions])

  const defaultCategory = categories.find(category => isSelectableTransactionCategory(category))?.name ?? ''
  const todayDate = getTodayDateString()

  const [state, dispatch] = useReducer(transactionFormReducer, getInitialState(todayDate, defaultCategory))

  const firstInputRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef('')
  const autocompletedDescriptionRef = useRef<string | null>(null)
  const documentsFieldRef = useRef<TransactionDocumentsFieldRef>(null)
  const [existingDocuments, setExistingDocuments] = useState<VaultDocument[]>([])
  const [initialDocumentChanges, setInitialDocumentChanges] = useState<TransactionDocumentChanges>({ pending: [], unlinkIds: [] })
  const [documentFieldRevision, setDocumentFieldRevision] = useState(0)

  useEffect(() => {
    descriptionRef.current = state.description
  }, [state.description])

  useEffect(() => {
    const flow = state.transactionType
    if (flow !== 'inflow' && flow !== 'outflow') return
    const currentCategory = categories.find(c => c.name.toLowerCase() === state.category.toLowerCase())
    if (!currentCategory) return
    if (currentCategory.type && currentCategory.type !== 'both' && currentCategory.type !== flow) {
      const replacement = categories.find(candidate => isSelectableTransactionCategory(candidate, flow))
      if (replacement) {
        dispatch({ type: 'SET_FIELD', field: 'category', value: replacement.name })
      }
    }
  }, [categories, state.transactionType, state.category])

  const openTransactionForm = useCallback(() => {
    dispatch({ type: 'SET_FIELD', field: 'showAddForm', value: true })
  }, [])

  const {
    resolveAcceptedTopUp,
    topUpBuckets,
    topUpOffer,
    isRecoveryCycleDate,
    savedTopUpMovedAcrossCycles,
  } = useStabilityTopUpOffer({
    state,
    transactions,
    cycleDay,
    stabilityTopUpContext,
  })

  useEffect(() => {
    if (state.mode !== 'create' || !state.stabilityTopUpAccepted || topUpOffer) return
    dispatch({ type: 'SET_FIELD', field: 'stabilityTopUpAccepted', value: false })
    dispatch({ type: 'SET_FIELD', field: 'stabilityTopUpAmount', value: '' })
  }, [state.mode, state.stabilityTopUpAccepted, topUpOffer])

  const { clearDraft: clearFormDraft } = useFormDraft(
    'ledger-tx-form',
    state.showAddForm,
    {
      editorMode: state.mode,
      editingTxId: state.editingId,
      description: state.description,
      amount: state.amount,
      txType: state.transactionType,
      category: state.category,
      ledgerCategory: state.ledgerCategory,
      transferSource: state.transferSource,
      transferTarget: state.transferTarget,
      date: state.date,
      accountId: state.accountId,
      counterAccountId: state.counterAccountId,
      splitAccountIds: state.splitAccountIds,
      stabilityTopUpAccepted: state.stabilityTopUpAccepted,
      stabilityTopUpAmount: state.stabilityTopUpAmount,
      stabilityReloadIntent: state.stabilityReloadIntent,
    },
    (saved) => {
      dispatch({
        type: 'OPEN_DRAFT',
        payload: {
          id: saved.editingTxId || '',
          description: saved.description,
          amount: saved.amount,
          txType: saved.txType,
          category: saved.category,
          ledgerCategory: saved.ledgerCategory,
          transferSource: saved.transferSource,
          transferTarget: saved.transferTarget,
          date: saved.date,
          accountId: saved.accountId,
          counterAccountId: saved.counterAccountId,
          splitAccountIds: saved.splitAccountIds,
          stabilityReloadIntent: saved.stabilityReloadIntent,
        }
      })
      descriptionRef.current = saved.description
      autocompletedDescriptionRef.current = null
    },
    // The sheet is route-mounted: the Ledger tab remounts it on every navigation into the page,
    // so restoring on mount reopened a stale sheet ("Edit Draft") each time the user came back.
    // The draft is still written while the sheet is open, and only an explicit action opens it.
    { restoreOnMount: false },
  )

  useEffect(() => {
    onAddFormOpenChange?.(state.showAddForm)
  }, [onAddFormOpenChange, state.showAddForm])

  const applyReceiptScanResult = useCallback((result: ReceiptScanResult) => {
    const ledgerCategory = result.ledgerCategory && ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(result.ledgerCategory)
      ? result.ledgerCategory as SelectableLedgerCategory
      : undefined
    dispatch({
      type: 'APPLY_RECEIPT',
      payload: { ...result, ledgerCategory },
      todayDate,
    })
    window.setTimeout(() => {
      firstInputRef.current?.focus()
      firstInputRef.current?.select()
    }, 450)
  }, [todayDate])

  const scanner = useReceiptScanDraft({
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
      s.txType === state.transactionType
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
      if (state.transferSource === state.transferTarget) {
        dispatch({ type: 'SET_FIELD', field: 'description', value: `Transfer within ${state.transferSource}` })
      } else {
        dispatch({ type: 'SET_FIELD', field: 'description', value: `Transfer from ${state.transferSource} to ${state.transferTarget}` })
      }
    }
  }, [state.transactionType, state.transferSource, state.transferTarget, state.editingId])

  useTransactionFormAccountEffects(state, accounts, dispatch)

  useEffect(() => {
    if (categories.length > 0 && !state.category) {
      dispatch({ type: 'SET_FIELD', field: 'category', value: defaultCategory })
    }
  }, [categories, state.category, defaultCategory])

  const lifecycle = useTransactionFormLifecycle({
    state,
    dispatch,
    accounts,
    transactions,
    defaultCategory,
    todayDate,
    hideSensitive,
    sensitivePreferenceStatus,
    autoOpenTxType,
    autoOpenPrefill,
    aiEditDraft,
    onAiEditDraftConsumed,
    onFetchTransactionById,
    onStartEditPending,
    onLoadDraftDocumentChanges,
    onShowAlert,
    descriptionRef,
    autocompletedDescriptionRef,
    documentsFieldRef,
    suggestions,
    scanner,
    clearFormDraft,
    openTransactionForm,
    setExistingDocuments,
    setInitialDocumentChanges,
    setDocumentFieldRevision,
    deriveIncomeSplitAccountIds,
  })

  useAutoOpenModal(autoOpenAddForm, () => lifecycle.openFresh(autoOpenTxType || undefined), onResetAutoOpen)

  const changeTransactionType = (type: 'inflow' | 'outflow' | 'transfer') => {
    if (state.mode === 'create') {
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      dispatch({ type: 'SET_FIELD', field: 'showAddForm', value: true })
    }
    if (state.mode === 'draft') {
      documentsFieldRef.current?.reset()
      setInitialDocumentChanges({ pending: [], unlinkIds: [] })
      setDocumentFieldRevision(revision => revision + 1)
    }
    dispatch({ type: 'SET_FIELD', field: 'transactionType', value: type })
  }

  useEffect(() => {
    if (!hideSensitive || sensitivePreferenceStatus === 'pending' || !state.showAddForm) return
    if (state.mode === 'create') lifecycle.handleCloseForm()
  }, [lifecycle.handleCloseForm, hideSensitive, sensitivePreferenceStatus, state.mode, state.showAddForm])

  const { handleSubmit } = useTransactionFormSubmit({
    state,
    dispatch,
    accountsLoading,
    hideSensitive,
    sensitivePreferenceStatus,
    resolveAcceptedTopUp,
    savedTopUpMovedAcrossCycles,
    topUpOffer,
    documentsFieldRef,
    isRecoveryCycleDate,
    stabilityTopUpContext,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    stabilityBalance,
    stabilityTarget,
    stabilityOverflowRedirect,
    onUpdateTransaction,
    onUpdateDraftTransaction,
    onAddTransaction,
    selectedMonth,
    selectedYear,
    cycleDay,
    onOutsideCycleSave,
    todayDate,
    defaultCategory,
    clearFormDraft,
    scanner,
  })

  const bucketOutflowWarning = useTransactionOutflowWarning(state, transactions, options)

  return {
    state,
    dispatch,
    firstInputRef,
    descriptionRef,
    autocompletedDescriptionRef,
    openFresh: lifecycle.openFresh,
    openWithDraft: lifecycle.openWithDraft,
    applyPrefill: lifecycle.applyPrefill,
    handleCloseForm: lifecycle.handleCloseForm,
    handleStartEdit: lifecycle.handleStartEdit,
    handleStartDraft: lifecycle.handleStartDraft,
    handleSubmit,
    changeTransactionType,
    scanner,
    suggestions,
    filteredSuggestions,
    quickSuggestionEntries,
    handleSelectSuggestion,
    documentsFieldRef,
    initialDocumentChanges,
    documentFieldRevision,
    existingDocuments,
    topUpOffer,
    topUpBuckets,
    bucketOutflowWarning,
    stabilityTopUpError: savedTopUpMovedAcrossCycles
      ? 'Remove this reimbursement before moving the salary to another cycle.'
      : undefined,
  }
}
