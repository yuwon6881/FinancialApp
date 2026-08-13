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
export type { UseTransactionFormOptions } from './useTransactionFormOptions'
export function useTransactionForm(options: UseTransactionFormOptions) {
  const {
    categories,
    accounts = [],
    accountsLoading = accounts.length === 0,
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
    onUpdateDraftTransaction,
    onLoadDraftDocumentChanges,
    onStartEditPending,
    onAddFormOpenChange,
    autoOpenAddForm,
    autoOpenTxType,
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
    sensitivePreferenceStatus,
  } = options

  const defaultCategory = categories.length > 0 ? categories[0].name : ''
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
    if (state.transactionType !== 'inflow' && state.transactionType !== 'outflow') return
    const currentCategory = categories.find(c => c.name.toLowerCase() === state.category.toLowerCase())
    if (!currentCategory) return
    if (currentCategory.type && currentCategory.type !== 'both' && currentCategory.type !== state.transactionType) {
      const validCategories = categories.filter(c => !c.isPendingDelete && (!c.type || c.type === 'both' || c.type === state.transactionType))
      if (validCategories.length > 0) {
        dispatch({ type: 'SET_FIELD', field: 'category', value: validCategories[0].name })
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
  const { resolveAcceptedTopUp, topUpBuckets, topUpOffer } = useStabilityTopUpOffer({
    state,
    transactions,
    stabilityRecovery,
    essentialsAlloc,
    growthAlloc,
    stabilityAlloc,
    rewardsAlloc,
    essentialsBalance,
    growthBalance,
    rewardsBalance,
  })

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
    }
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
        accountId: t.accountId,
        counterAccountId: t.counterAccountId,
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
  }, [hideSensitive, suggestions, onStartEditPending, onShowAlert, openTransactionForm])

  const handleStartDraft = useCallback(async (draft: Transaction) => {
    if (hideSensitive) return
    let changes: TransactionDocumentChanges = { pending: [], unlinkIds: [] }
    if (onLoadDraftDocumentChanges) {
      changes = await onLoadDraftDocumentChanges(draft.id)
    }
    setExistingDocuments([])
    setInitialDocumentChanges(changes)
    setDocumentFieldRevision(revision => revision + 1)
    dispatch({
      type: 'OPEN_DRAFT',
      payload: {
        id: draft.id,
        description: draft.description,
        amount: Math.abs(draft.amount).toFixed(2),
        date: draft.date,
        category: draft.category,
        ledgerCategory: draft.ledgerCategory.startsWith('Transfer:') ? 'Essentials' : draft.ledgerCategory,
        txType: draft.ledgerCategory.startsWith('Transfer:') ? 'transfer' : (draft.amount < 0 ? 'outflow' : 'inflow'),
        transferSource: draft.ledgerCategory.startsWith('Transfer:') ? (draft.ledgerCategory.substring(9).split('->')[0].trim() as TransferBucket) : undefined,
        transferTarget: draft.ledgerCategory.startsWith('Transfer:') ? (draft.ledgerCategory.substring(9).split('->')[1].trim() as TransferBucket) : undefined,
        accountId: draft.accountId,
        counterAccountId: draft.counterAccountId,
        stabilityRecoveryTopUpAmount: draft.stabilityRecoveryTopUpAmount,
        stabilityReloadIntent: draft.stabilityReloadIntent,
      },
    })
    descriptionRef.current = draft.description
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }, [hideSensitive, onLoadDraftDocumentChanges, openTransactionForm, suggestions])

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
    if (state.ledgerCategory === 'AccountMove' || accounts.length === 0) return
    const bucket = state.transactionType === 'transfer'
      ? state.transferSource
      : (['Essentials', 'Growth', 'Stability', 'Rewards'].includes(state.ledgerCategory) ? state.ledgerCategory : null)
    if (bucket) {
      const selected = state.accountId ? accounts.find(account => account.id === state.accountId) : undefined
      const defaultId = accounts.find(account => account.bucket === bucket && account.isDefault && !account.isArchived)?.id ?? ''
      if ((!selected || selected.bucket !== bucket) && state.accountId !== defaultId) {
        dispatch({ type: 'SET_FIELD', field: 'accountId', value: defaultId })
      }
    }
    if (state.transactionType === 'transfer') {
      const selectedTarget = state.counterAccountId ? accounts.find(account => account.id === state.counterAccountId) : undefined
      const targetDefaultId = accounts.find(account => account.bucket === state.transferTarget && account.isDefault && !account.isArchived)?.id ?? ''
      const nextTargetId = targetDefaultId || null
      if ((!selectedTarget || selectedTarget.bucket !== state.transferTarget) && state.counterAccountId !== nextTargetId) {
        dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: nextTargetId })
      }
    } else if (state.counterAccountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'counterAccountId', value: null })
    }
    if (!bucket && state.transactionType !== 'transfer' && state.ledgerCategory !== 'Income' && state.accountId !== null) {
      dispatch({ type: 'SET_FIELD', field: 'accountId', value: null })
    }
  }, [accounts, state.accountId, state.counterAccountId, state.ledgerCategory, state.transactionType, state.transferSource, state.transferTarget])

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
        defaultAccountId: accounts.find(account => account.bucket === 'Essentials' && account.isDefault && !account.isArchived)?.id,
      },
    })
    const targetTxType = initialTxType || autoOpenTxType
    if (targetTxType) {
      dispatch({ type: 'SET_FIELD', field: 'transactionType', value: targetTxType })
    }
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
    suggestions.clearSuggestions()
    openTransactionForm()
  }, [accounts, hideSensitive, sensitivePreferenceStatus, defaultCategory, todayDate, autoOpenTxType, suggestions, openTransactionForm])

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
        defaultAccountId: accounts.find(account => account.bucket === 'Essentials' && account.isDefault && !account.isArchived)?.id,
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
      accountTrackingEnabled: accounts.length > 0,
    })

    if (Object.keys(validationErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: validationErrors })
      focusFirstInvalidField(e.currentTarget)
      return
    }

    if (state.stabilityTopUpAccepted) {
      const chosenTopUp = resolveAcceptedTopUp()
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
      essentialsAlloc,
      growthAlloc,
      stabilityAlloc,
      rewardsAlloc,
      stabilityBalance,
      stabilityTarget,
      stabilityOverflowRedirect,
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
  }
}
