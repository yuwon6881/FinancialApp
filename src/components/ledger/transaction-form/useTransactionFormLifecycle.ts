import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction, type MutableRefObject, type RefObject } from 'react'
import type { LedgerAccount, Transaction, TransactionDocumentChanges, VaultDocument } from '../../../types'
import type { TransactionFormAction, TransactionFormState, TransferBucket, SelectableLedgerCategory } from './transactionFormReducer'
import type { TransactionPrefillDraft } from '../TransactionFormSheet'
import type { TransactionDocumentsFieldRef } from './TransactionDocumentsField'
import { canOpenBlankMutationForm } from '../../../lib/quickAddAvailability'
import type { SensitivePreferenceStatus } from '../../../app/useAppPreferences'

export interface UseTransactionFormLifecycleOptions {
  state: TransactionFormState
  dispatch: Dispatch<TransactionFormAction>
  accounts: LedgerAccount[]
  transactions: Transaction[]
  defaultCategory: string
  todayDate: string
  hideSensitive?: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  autoOpenTxType?: 'inflow' | 'outflow' | 'transfer' | null
  autoOpenPrefill?: any
  aiEditDraft?: { id: string | number; changes: any; nonce?: number } | null
  onAiEditDraftConsumed?: () => void
  onFetchTransactionById?: (id: string) => Promise<Transaction | undefined>
  onStartEditPending?: (id: string | null) => void
  onLoadDraftDocumentChanges?: (id: string) => Promise<TransactionDocumentChanges>
  onShowAlert?: (message: string, title?: string) => void
  descriptionRef: MutableRefObject<string>
  autocompletedDescriptionRef: MutableRefObject<string | null>
  documentsFieldRef: RefObject<TransactionDocumentsFieldRef | null>
  suggestions: { clearSuggestions: () => void }
  scanner: { clearScan: () => void }
  clearFormDraft: () => void
  openTransactionForm: () => void
  setExistingDocuments: Dispatch<SetStateAction<VaultDocument[]>>
  setInitialDocumentChanges: Dispatch<SetStateAction<TransactionDocumentChanges>>
  setDocumentFieldRevision: Dispatch<SetStateAction<number>>
  deriveIncomeSplitAccountIds: (t: Transaction) => any
}

export function useTransactionFormLifecycle(options: UseTransactionFormLifecycleOptions) {
  const {
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
  } = options

  /**
   * Invalidation token for the attached-document lookup.
   *
   * Detach unlinks by document id, so a response that arrives after the sheet has moved on is not
   * merely stale: listing transaction A's documents under transaction B lets Save detach a file
   * from A while the user is looking at B. Every entry point that repoints the sheet bumps this,
   * and only the newest lookup may write.
   */
  const documentLookupRef = useRef(0)

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
    const lookupId = ++documentLookupRef.current
    setExistingDocuments([])
    void import('../../../lib/api/documents')
      .then(({ listAllDocumentsForTransaction }) => listAllDocumentsForTransaction(t.id))
      .then(documents => {
        if (documentLookupRef.current === lookupId) setExistingDocuments(documents)
      })
      .catch(() => {
        if (documentLookupRef.current === lookupId) {
          onShowAlert?.('Attached documents could not be loaded.', 'Document Vault')
        }
      })
    openTransactionForm()
  }, [accounts, deriveIncomeSplitAccountIds, hideSensitive, suggestions, onStartEditPending, onShowAlert, openTransactionForm, setExistingDocuments, setInitialDocumentChanges, setDocumentFieldRevision, dispatch, descriptionRef, autocompletedDescriptionRef])

  const handleStartDraft = useCallback(async (draft: Transaction) => {
    if (hideSensitive) return
    let changes: TransactionDocumentChanges = { pending: [], unlinkIds: [] }
    if (onLoadDraftDocumentChanges) {
      changes = await onLoadDraftDocumentChanges(draft.id)
    }
    documentLookupRef.current += 1
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
  }, [accounts, deriveIncomeSplitAccountIds, hideSensitive, onLoadDraftDocumentChanges, openTransactionForm, suggestions, setExistingDocuments, setInitialDocumentChanges, setDocumentFieldRevision, dispatch, descriptionRef, autocompletedDescriptionRef])

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
  }, [aiEditDraft?.nonce, handleStartEdit, transactions, onFetchTransactionById, onShowAlert, onAiEditDraftConsumed, dispatch, todayDate])

  const openFresh = useCallback((initialTxType?: 'inflow' | 'outflow' | 'transfer') => {
    if (!canOpenBlankMutationForm(Boolean(hideSensitive), sensitivePreferenceStatus)) return
    documentLookupRef.current += 1
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
    const targetTxType = initialTxType || autoOpenTxType
    if (targetTxType) {
      dispatch({ type: 'SET_FIELD', field: 'transactionType', value: targetTxType })
    }
    descriptionRef.current = ''
    autocompletedDescriptionRef.current = null
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
  }, [hideSensitive, sensitivePreferenceStatus, defaultCategory, todayDate, autoOpenTxType, autoOpenPrefill, suggestions, openTransactionForm, setExistingDocuments, setInitialDocumentChanges, setDocumentFieldRevision, documentsFieldRef, dispatch, descriptionRef, autocompletedDescriptionRef])

  const openWithDraft = (draft: TransactionPrefillDraft) => {
    if (hideSensitive) return
    documentLookupRef.current += 1
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

  /**
   * Take a computed draft (today: the shared-receipt split's "your share") into the sheet.
   *
   * A create form is replaced wholesale, but an open edit or draft is edited in place. Both already
   * point at a saved row, and routing them through openWithDraft reopened the sheet as a blank
   * create: the row was left untouched on the server while every change the user had made to it
   * disappeared, with no warning and nothing to undo.
   */
  const applyPrefill = (draft: TransactionPrefillDraft) => {
    const editsInPlace = state.showAddForm && (state.mode === 'draft' || state.mode === 'edit')
    if (!editsInPlace) {
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
        // A saved row's direction is fixed for its lifetime — the type control is disabled in edit
        // mode for the same reason — so the split's outflow must not retype it. The amount is a
        // magnitude; the sign comes from the type that is already there.
        txType: state.mode === 'edit' ? undefined : draft.txType,
      },
      todayDate,
    })
  }

  const handleCloseForm = useCallback(() => {
    documentsFieldRef.current?.reset()
    documentLookupRef.current += 1
    setExistingDocuments([])
    setInitialDocumentChanges({ pending: [], unlinkIds: [] })
    dispatch({ type: 'CLOSE' })
    clearFormDraft()
    suggestions.clearSuggestions()
    scanner.clearScan()
    if (state.editingId && onStartEditPending) {
      onStartEditPending(null)
    }
  }, [clearFormDraft, dispatch, documentsFieldRef, onStartEditPending, scanner, setExistingDocuments, setInitialDocumentChanges, state.editingId, suggestions])

  return {
    handleStartEdit,
    handleStartDraft,
    openFresh,
    openWithDraft,
    applyPrefill,
    handleCloseForm,
  }
}
