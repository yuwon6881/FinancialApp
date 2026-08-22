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
  TransactionDocumentChanges,
  VaultDocument,
} from '../../../types'
import { useStabilityTopUpOffer } from './useStabilityTopUpOffer'
import type { TransactionPrefillDraft } from '../TransactionFormSheet'
import type { TransactionDocumentsFieldRef } from './TransactionDocumentsField'
import { focusFirstInvalidField } from '../../ui/formValidation'
import type { ReceiptScanResult } from '../../../lib/api'
import { getErrorMessage } from '../../../lib/errors'
import { canOpenBlankMutationForm } from '../../../lib/quickAddAvailability'
import type { UseTransactionFormOptions } from './useTransactionFormOptions'
import { getBucketOutflowWarning, type BucketOutflowWarning, type OutflowBucket } from '../../../lib/transactionBucketWarnings'
import { isTransactionOutsideCycle } from '../../../lib/transactionCyclePlacement'
import { isSelectableTransactionCategory } from '../../../lib/categoryFlow'

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

  // Whatever this picks has to be an option the category select actually offers, so it is chosen
  // with the same predicate the select filters by. Taking `categories[0]` blindly could seed an
  // app-owned name (`Transfer`, `Adjustment`) or one queued for deletion — a value with no
  // matching option, which the user cannot see and cannot correct, yet still gets saved.
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

  /**
   * The top-up actually applied on submit. An empty amount field means "use the suggestion", and
   * whatever is typed is clamped to what this pay packet can move — the field can hold an
   * over-max value while being edited, and that must never reach the ledger.
   */
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
      accountId: state.accountId,
      counterAccountId: state.counterAccountId,
      splitAccountIds: state.splitAccountIds,
      date: state.date
    },
    (draft) => {
      dispatch({
        type: draft.editorMode === 'draft' ? 'OPEN_DRAFT' : 'OPEN_EDIT',
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
          accountId: draft.accountId,
          counterAccountId: draft.counterAccountId,
        }
      })
      if (draft.editingTxId && onStartEditPending) {
        onStartEditPending(draft.editingTxId)
      }
      if (draft.editorMode === 'draft' && draft.editingTxId && onLoadDraftDocumentChanges) {
        void onLoadDraftDocumentChanges(draft.editingTxId).then(changes => {
          setInitialDocumentChanges(changes)
          setDocumentFieldRevision(revision => revision + 1)
        })
      }
      openTransactionForm()
    },
    { restoreOnMount: false }
  )

  useEffect(() => {
    onAddFormOpenChange?.(state.showAddForm)
    return () => {
      onAddFormOpenChange?.(false)
    }
  }, [state.showAddForm, onAddFormOpenChange])

  // Receipt Scan results
  const applyReceiptScanResult = useCallback((result: ReceiptScanResult) => {
    const ledgerCategory = ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(result.ledgerCategory)
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
    setInitialDocumentChanges({ pending: [], unlinkIds: [] })
    setDocumentFieldRevision(revision => revision + 1)
    const isTransfer = t.ledgerCategory.startsWith('Transfer:')
    const isAccountMove = t.ledgerCategory.toLowerCase() === 'accountmove'
    const moveBucket = isAccountMove
      ? (accounts.find(a => a.id === t.accountId)?.bucket ?? accounts.find(a => a.id === t.counterAccountId)?.bucket ?? 'Essentials')
      : undefined
    dispatch({
      type: 'OPEN_EDIT',
      payload: {
        id: t.id,
        description: t.description,
        amount: Math.abs(t.amount).toFixed(2),
        date: t.date,
        category: t.category,
        ledgerCategory: isTransfer ? 'Essentials' : t.ledgerCategory,
        txType: isTransfer || isAccountMove ? 'transfer' : (t.amount < 0 ? 'outflow' : 'inflow'),
        transferSource: isTransfer
          ? (t.ledgerCategory.substring(9).split('->')[0].trim() as TransferBucket)
          : (isAccountMove ? (moveBucket as TransferBucket) : undefined),
        transferTarget: isTransfer
          ? (t.ledgerCategory.substring(9).split('->')[1].trim() as TransferBucket)
          : (isAccountMove ? (moveBucket as TransferBucket) : undefined),
        accountId: t.accountId,
        counterAccountId: t.counterAccountId,
        splitAccountIds: deriveIncomeSplitAccountIds(t),
        stabilityRecoveryTopUpAmount: t.stabilityRecoveryTopUpAmount,
        stabilityReloadIntent: t.stabilityReloadIntent,
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
  }, [accounts, deriveIncomeSplitAccountIds, hideSensitive, suggestions, onStartEditPending, onShowAlert, openTransactionForm])

  const handleStartDraft = useCallback(async (draft: Transaction) => {
    if (hideSensitive) return
    let changes: TransactionDocumentChanges = { pending: [], unlinkIds: [] }
    if (onLoadDraftDocumentChanges) {
      changes = await onLoadDraftDocumentChanges(draft.id)
    }
    setExistingDocuments([])
    setInitialDocumentChanges(changes)
    setDocumentFieldRevision(revision => revision + 1)
    const isTransfer = draft.ledgerCategory.startsWith('Transfer:')
    const isAccountMove = draft.ledgerCategory.toLowerCase() === 'accountmove'
    const moveBucket = isAccountMove
      ? (accounts.find(a => a.id === draft.accountId)?.bucket ?? accounts.find(a => a.id === draft.counterAccountId)?.bucket ?? 'Essentials')
      : undefined
    dispatch({
      type: 'OPEN_DRAFT',
      payload: {
        id: draft.id,
        description: draft.description,
        amount: Math.abs(draft.amount).toFixed(2),
        date: draft.date,
        category: draft.category,
        ledgerCategory: draft.ledgerCategory.startsWith('Transfer:') ? 'Essentials' : draft.ledgerCategory,
        txType: isTransfer || isAccountMove ? 'transfer' : (draft.amount < 0 ? 'outflow' : 'inflow'),
        transferSource: isTransfer
          ? (draft.ledgerCategory.substring(9).split('->')[0].trim() as TransferBucket)
          : (isAccountMove ? (moveBucket as TransferBucket) : undefined),
        transferTarget: isTransfer
          ? (draft.ledgerCategory.substring(9).split('->')[1].trim() as TransferBucket)
          : (isAccountMove ? (moveBucket as TransferBucket) : undefined),
        accountId: draft.accountId,
        counterAccountId: draft.counterAccountId,
         splitAccountIds: deriveIncomeSplitAccountIds(draft),
        stabilityRecoveryTopUpAmount: draft.stabilityRecoveryTopUpAmount,
        stabilityReloadIntent: draft.stabilityReloadIntent,
      },
    })
    descriptionRef.current = draft.description
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }, [accounts, deriveIncomeSplitAccountIds, hideSensitive, onLoadDraftDocumentChanges, openTransactionForm, suggestions])

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
      if (state.transferSource === state.transferTarget) {
        dispatch({ type: 'SET_FIELD', field: 'description', value: `Transfer within ${state.transferSource}` })
      } else {
        dispatch({ type: 'SET_FIELD', field: 'description', value: `Transfer from ${state.transferSource} to ${state.transferTarget}` })
      }
    }
  }, [state.transactionType, state.transferSource, state.transferTarget, state.editingId])

  useEffect(() => {
    if (state.ledgerCategory === 'AccountMove' || accounts.length === 0) return
    const bucket = state.transactionType === 'transfer'
      ? state.transferSource
      : (['Essentials', 'Growth', 'Stability', 'Rewards'].includes(state.ledgerCategory) ? state.ledgerCategory : null)
    if (bucket) {
      const selected = state.accountId ? accounts.find(account => account.id === state.accountId) : undefined
      const live = accounts.filter(account => account.bucket === bucket && !account.isArchived)
      const nextId = selected?.bucket === bucket && !selected.isArchived
        ? selected.id
        : live.length === 1 ? live[0].id : ''
      if (state.accountId !== nextId) {
        dispatch({ type: 'SET_FIELD', field: 'accountId', value: nextId })
      }
    }
    if (state.transactionType === 'transfer') {
      const isSameBucket = state.transferSource === state.transferTarget
      const selectedTarget = state.counterAccountId ? accounts.find(account => account.id === state.counterAccountId) : undefined
      if (isSameBucket) {
        const otherAccounts = accounts.filter(account => account.bucket === state.transferTarget && !account.isArchived && account.id !== state.accountId)
        if (!selectedTarget || selectedTarget.bucket !== state.transferTarget || selectedTarget.id === state.accountId) {
          const nextTargetId = otherAccounts.length === 1 ? otherAccounts[0].id : null
          if (state.counterAccountId !== nextTargetId) {
            dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: nextTargetId })
          }
        }
      } else {
        const liveTarget = accounts.filter(account => account.bucket === state.transferTarget && !account.isArchived)
        const nextTargetId = selectedTarget?.bucket === state.transferTarget && !selectedTarget.isArchived
          ? selectedTarget.id
          : liveTarget.length === 1 ? liveTarget[0].id : ''
        if (state.counterAccountId !== nextTargetId) {
          dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: nextTargetId })
        }
      }
    } else if (state.counterAccountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: null })
    }
    if (!bucket && state.transactionType !== 'transfer' && state.ledgerCategory !== 'Income' && state.accountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'accountId', value: null })
    }
  }, [accounts, state.accountId, state.counterAccountId, state.ledgerCategory, state.transactionType, state.transferSource, state.transferTarget])

  useEffect(() => {
    if (accounts.length === 0) return
    const buckets: TransferBucket[] = ['Essentials', 'Growth', 'Stability', 'Rewards']
    for (const bucket of buckets) {
      const selected = accounts.find(account => account.id === state.splitAccountIds[bucket])
      const live = accounts.filter(account => account.bucket === bucket && !account.isArchived)
      const nextId = selected?.bucket === bucket && !selected.isArchived
        ? selected.id
        : live.length === 1 ? live[0].id : ''
      if (state.splitAccountIds[bucket] !== nextId) {
        dispatch({ type: 'SET_SPLIT_ACCOUNT', bucket, accountId: nextId })
      }
    }
  }, [accounts, state.splitAccountIds])

  useEffect(() => {
    if (categories.length > 0 && !state.category) {
      dispatch({ type: 'SET_FIELD', field: 'category', value: defaultCategory })
    }
  }, [categories, state.category, defaultCategory])

  const openFresh = useCallback((initialTxType?: 'inflow' | 'outflow' | 'transfer') => {
    // The app is safe-by-default while the server preference is still resolving. Allow the
    // blank FAB editor to mount during that short window, but leave every save path behind
    // the existing sensitive-mode guard until the preference is known.
    if (!canOpenBlankMutationForm(hideSensitive, sensitivePreferenceStatus)) return
    setExistingDocuments([])
    setInitialDocumentChanges({ pending: [], unlinkIds: [] })
    setDocumentFieldRevision(revision => revision + 1)
    documentsFieldRef.current?.reset()
    dispatch({
      type: 'OPEN_CREATE',
      payload: {
        defaultCategory,
        todayDate,
        // New postings start unplaced; the sole-live-account effect selects only an unambiguous account.
      },
    })
    const targetTxType = initialTxType || autoOpenTxType
    if (targetTxType) {
      dispatch({ type: 'SET_FIELD', field: 'transactionType', value: targetTxType })
    }
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    // A caller that already knows where this money landed fills the placement in;
    // the amount is deliberately left blank, since only the user knows it.
    // This runs *after* the description reset above, which would otherwise clear the ref again.
    if (autoOpenPrefill) {
      if (autoOpenPrefill.category) {
        dispatch({ type: 'SET_FIELD', field: 'category', value: autoOpenPrefill.category })
      }
      if (autoOpenPrefill.ledgerCategory) {
        dispatch({ type: 'SET_FIELD', field: 'ledgerCategory', value: autoOpenPrefill.ledgerCategory })
      }
      if (autoOpenPrefill.accountId) {
        dispatch({ type: 'SET_FIELD', field: 'accountId', value: autoOpenPrefill.accountId })
      }
      if (autoOpenPrefill.description) {
        dispatch({ type: 'SET_FIELD', field: 'description', value: autoOpenPrefill.description })
        descriptionRef.current = autoOpenPrefill.description
      }
    }
    suggestions.clearSuggestions()
    openTransactionForm()
  }, [accounts, hideSensitive, sensitivePreferenceStatus, defaultCategory, todayDate, autoOpenTxType, autoOpenPrefill, suggestions, openTransactionForm])

  useAutoOpenModal(autoOpenAddForm, () => openFresh(autoOpenTxType || undefined), onResetAutoOpen)

  const openWithDraft = (draft: TransactionPrefillDraft) => {
    if (hideSensitive) return
    setExistingDocuments([])
    setInitialDocumentChanges({ pending: [], unlinkIds: [] })
    setDocumentFieldRevision(revision => revision + 1)
    documentsFieldRef.current?.reset()
    dispatch({
      type: 'OPEN_CREATE',
      payload: {
        defaultCategory,
        todayDate,
      },
    })
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
    if (draft.accountId) {
      dispatch({ type: 'SET_FIELD', field: 'accountId', value: draft.accountId })
    }
    descriptionRef.current = draft.description
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }

  const applyPrefill = (draft: TransactionPrefillDraft) => {
    if (state.mode !== 'draft') {
      openWithDraft(draft)
      return
    }
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
  }

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

  const handleCloseForm = () => {
    documentsFieldRef.current?.reset()
    setExistingDocuments([])
    setInitialDocumentChanges({ pending: [], unlinkIds: [] })
    dispatch({ type: 'CLOSE' })
    clearFormDraft()
    suggestions.clearSuggestions()
    scanner.clearScan()
    if (state.editingId && onStartEditPending) {
      onStartEditPending(null)
    }
  }

  useEffect(() => {
    if (!hideSensitive || sensitivePreferenceStatus === 'pending' || !state.showAddForm) return
    // A blank quick-add sheet may be useful while the preference is still pending, but it must
    // not remain open as soon as the server confirms sensitive mode. Existing edit/draft flows
    // keep their normal lifecycle; their save guard still prevents a mutation.
    if (state.mode === 'create') handleCloseForm()
  }, [handleCloseForm, hideSensitive, sensitivePreferenceStatus, state.mode, state.showAddForm])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (hideSensitive || sensitivePreferenceStatus === 'pending') {
      dispatch({
        type: 'SET_ERRORS',
        errors: {
          submit: sensitivePreferenceStatus === 'pending'
            ? 'Finishing security check…'
            : 'Reveal sensitive data before saving financial changes.',
        },
      })
      return
    }
    if (accountsLoading) {
      dispatch({ type: 'SET_ERRORS', errors: { submit: 'Loading accounts… Please wait a moment before saving.' } })
      return
    }
    const validationErrors = validateTransactionForm({
      description: state.description,
      amount: state.amount,
      date: state.date,
      transactionType: state.transactionType,
      ledgerCategory: state.ledgerCategory,
      transferSource: state.transferSource,
      transferTarget: state.transferTarget,
      accountId: state.accountId,
      counterAccountId: state.counterAccountId,
      stabilityReloadIntent: state.stabilityReloadIntent,
    })

    if (Object.keys(validationErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: validationErrors })
      focusFirstInvalidField(e.currentTarget)
      return
    }

    if (state.stabilityTopUpAccepted) {
      const chosenTopUp = resolveAcceptedTopUp()
      if (savedTopUpMovedAcrossCycles) {
        dispatch({
          type: 'SET_ERRORS',
          errors: {
            stabilityTopUpAmount: 'Remove this reimbursement before moving the salary to another cycle.',
          },
        })
        focusFirstInvalidField(e.currentTarget)
        return
      }
      if (!topUpOffer || !Number.isFinite(chosenTopUp) || chosenTopUp <= 0 || chosenTopUp > topUpOffer.maxTopUp) {
        dispatch({
          type: 'SET_ERRORS',
          errors: {
            stabilityTopUpAmount: 'Enter a valid reimbursement within the available maximum.',
          },
        })
        focusFirstInvalidField(e.currentTarget)
        return
      }
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
      essentialsAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.essentialsAlloc : essentialsAlloc,
      growthAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.growthAlloc : growthAlloc,
      stabilityAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.stabilityAlloc : stabilityAlloc,
      rewardsAlloc: isRecoveryCycleDate ? stabilityTopUpContext!.rewardsAlloc : rewardsAlloc,
      stabilityBalance: isRecoveryCycleDate ? stabilityTopUpContext!.recovery.currentBalance : stabilityBalance,
      stabilityTarget: isRecoveryCycleDate ? stabilityTopUpContext!.recovery.target : stabilityTarget,
      stabilityOverflowRedirect: isRecoveryCycleDate
        ? stabilityTopUpContext!.stabilityOverflowRedirect
        : stabilityOverflowRedirect,
      recoveryTopUp: resolveAcceptedTopUp(),
    })

    const documentChanges = documentsFieldRef.current?.getChanges() ?? { pending: [], unlinkIds: [] }

    try {
      if (state.mode === 'edit' && state.editingId) {
        await onUpdateTransaction?.(state.editingId, mapped, documentChanges)
      } else if (state.mode === 'draft' && state.editingId) {
        await onUpdateDraftTransaction?.(state.editingId, mapped, documentChanges)
      } else {
        await onAddTransaction(mapped, documentChanges)
      }
      if (isTransactionOutsideCycle(mapped.date, selectedMonth, selectedYear, cycleDay)) {
        onOutsideCycleSave?.(mapped.date)
      }
      dispatch({ type: 'RESET', todayDate, defaultCategory })
      clearFormDraft()
      scanner.clearScan()
    } catch (error) {
      dispatch({
        type: 'SET_ERRORS',
        errors: { submit: getErrorMessage(error, 'This transaction could not be saved. Please try again.') },
      })
      return
    }

    documentsFieldRef.current?.reset()
  }

  const outflowBucket: OutflowBucket | null = useMemo(() => {
    if (state.transactionType === 'transfer') {
      return (state.transferSource as OutflowBucket) ?? 'Essentials'
    }
    if (
      state.transactionType === 'outflow' &&
      state.ledgerCategory !== 'AccountMove' &&
      state.ledgerCategory !== 'Income'
    ) {
      return (state.ledgerCategory as OutflowBucket) ?? 'Essentials'
    }
    return null
  }, [state.transactionType, state.transferSource, state.ledgerCategory])

  const existingAmountInBucket = useMemo(() => {
    if (state.mode !== 'edit' || !state.editingId) return 0
    const original = transactions.find(t => t.id === state.editingId)
    if (!original || !outflowBucket) return 0

    const isTransfer = original.ledgerCategory.startsWith('Transfer:')
    if (isTransfer) {
      const originalSource = original.ledgerCategory.substring(9).split('->')[0].trim()
      return originalSource.toLowerCase() === outflowBucket.toLowerCase()
        ? Math.abs(original.amount)
        : 0
    }
    if (original.ledgerCategory.toLowerCase() === outflowBucket.toLowerCase()) {
      return Math.abs(original.amount)
    }
    return 0
  }, [state.mode, state.editingId, transactions, outflowBucket])

  const bucketOutflowWarning = useMemo<BucketOutflowWarning | null>(() => {
    if (!outflowBucket) return null
    const parsedAmount = parseFloat(state.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null

    return getBucketOutflowWarning({
      bucket: outflowBucket,
      amount: parsedAmount,
      existingAmountInBucket,
      context: {
        categories: options.ledgerSummaries,
        savingsGoals: options.savingsGoals,
        activeRecurringPayments: options.activeRecurringPayments,
        targetStabilityFund: options.stabilityTarget,
      },
    })
  }, [
    outflowBucket,
    state.amount,
    existingAmountInBucket,
    options.ledgerSummaries,
    options.savingsGoals,
    options.activeRecurringPayments,
    options.stabilityTarget,
  ])

  return {
    state,
    dispatch,
    firstInputRef,
    descriptionRef,
    autocompletedDescriptionRef,
    openFresh,
    openWithDraft,
    applyPrefill,
    handleCloseForm,
    handleStartEdit,
    handleStartDraft,
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
