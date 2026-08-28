import type { QueuedOp } from '../../lib/outbox'
import * as api from '../../lib/api'
import { CACHE_KEYS, setCachedJSON } from '../../lib/cache'
import { getErrorMessage } from '../../lib/errors'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'
import type {
  TransactionCategory,
  WishlistItem,
  SavingsGoal,
  RecurringPayment,
  LedgerAccount,
  TransactionDocumentChanges,
} from '../../types'
import { queuedTransactionDeleteCoversTarget } from './financialDataTypes'
import type { useLoanData } from './useLoanData'
import type { RefreshHintSummary, RefreshSlice } from '../../lib/refreshSlices'

export interface UseOutboxRefreshOptions {
  pendingTransactionDocumentsRef: React.MutableRefObject<Map<string, TransactionDocumentChanges>>
  pendingTransactionDocumentDeletesRef: React.MutableRefObject<Map<string, number[]>>
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  getPendingOps: () => QueuedOp[]
  setError: React.Dispatch<React.SetStateAction<string | null>>
  isServerAwakeRef: React.MutableRefObject<boolean>
  setWishlist: React.Dispatch<React.SetStateAction<WishlistItem[]>>
  setSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>
  loanData: ReturnType<typeof useLoanData>
  setRecurringPayments: React.Dispatch<React.SetStateAction<RecurringPayment[]>>
  setAccounts: React.Dispatch<React.SetStateAction<LedgerAccount[]>>
  setCategoriesList: React.Dispatch<React.SetStateAction<TransactionCategory[]>>
  loadAll: (
    month?: string,
    year?: number,
    isBackground?: boolean,
    rethrowOnError?: boolean,
    shouldCommit?: () => boolean,
    refreshSlices?: readonly RefreshSlice[],
  ) => Promise<void>
  selectedMonth: string
  selectedYear: number
  unconfirmedSettingWritesRef: React.MutableRefObject<Map<string, unknown>>
}

export function createOutboxRefreshHandler(options: UseOutboxRefreshOptions) {
  const {
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    showToast,
    getPendingOps,
    setError,
    isServerAwakeRef,
    setWishlist,
    setSavingsGoals,
    loanData,
    setRecurringPayments,
    setAccounts,
    setCategoriesList,
    loadAll,
    selectedMonth,
    selectedYear,
    unconfirmedSettingWritesRef,
  } = options

  const awaitInvestmentReconciliation = async (operationIds?: string[]) => {
    const reconciliations: Promise<void>[] = []
    window.dispatchEvent(new CustomEvent('investment-sync', {
      detail: {
        operations: operationIds,
        acknowledge: (work: Promise<void>) => { reconciliations.push(work) },
      },
    }))
    await Promise.all(reconciliations)
  }

  const awaitDocumentReconciliation = async () => {
    const reconciliations: Promise<void>[] = []
    window.dispatchEvent(new CustomEvent('documents-sync', {
      detail: {
        acknowledge: (work: Promise<void>) => { reconciliations.push(work) },
      },
    }))
    await Promise.all(reconciliations)
  }

  return async (
    successfulOps: ReadonlyArray<{ op: QueuedOp }>,
    refreshHints?: RefreshHintSummary,
  ) => {
    const ops = successfulOps.map(({ op }) => op)
    let documentsNeedRefresh = false
    for (const op of ops) {
      if (op.entity !== 'transaction') continue

      if (op.type === 'delete') {
        const documentIds = pendingTransactionDocumentDeletesRef.current.get(op.targetId)
        if (!documentIds) continue
        documentsNeedRefresh = true
        pendingTransactionDocumentDeletesRef.current.delete(op.targetId)
        try {
          const { deleteDocument } = await import('../../lib/api/documents')
          for (const documentId of documentIds) {
            await deleteDocument(documentId)
          }
        } catch (error) {
          showToast(
            getErrorMessage(error, 'The transaction was deleted, but its attached documents could not be removed. They are still in your Document Vault.'),
            'Document Vault',
            'error',
          )
        }
        continue
      }

      if (op.type !== 'add' && op.type !== 'update') continue
      const documentChanges = pendingTransactionDocumentsRef.current.get(op.targetId)
      if (!documentChanges) continue
      documentsNeedRefresh = true

      // An Undo tapped on the add's own success toast queues the delete while this refresh is
      // still running, so uploading here would attach files to a row that is about to go and
      // leave them orphaned in the vault with the user believing they undid the whole thing.
      if (getPendingOps().some(pending => queuedTransactionDeleteCoversTarget(pending, op.targetId))) {
        pendingTransactionDocumentsRef.current.delete(op.targetId)
        continue
      }

      try {
        // Both imported lazily: this hook sits on the eager critical path, while the
        // vault API and the canvas compression helper are only needed once a queued
        // document change actually drains.
        const { updateDocument, uploadDocument } = await import('../../lib/api/documents')

        for (const documentId of documentChanges.unlinkIds) {
          await updateDocument(documentId, { transactionId: null })
        }
        if (documentChanges.pending.length > 0) {
          const { compressImageFile } = await import('../../lib/imageCompression')

          for (const pending of documentChanges.pending) {
            const uploadFile = await compressImageFile(pending.file)
            await uploadDocument(
              uploadFile,
              pending.taxYear,
              op.targetId,
              undefined,
              pending.reliefCategory,
              pending.amount,
              pending.amountCurrency,
            )
          }
        }
      } catch (error) {
        showToast(
          getErrorMessage(error, 'The transaction was saved, but one or more document changes failed. Any uploaded document remains safe in the Document Vault.'),
          'Document Vault',
          'error',
        )
      } finally {
        pendingTransactionDocumentsRef.current.delete(op.targetId)
      }
    }

    // The collector is the compatibility boundary. A batch with valid server hints gets one
    // partial bootstrap request; missing, malformed, unknown, or conservative `all` metadata uses
    // the existing full bootstrap fallback. This must run before the legacy entity fast paths so a
    // valid multi-slice response cannot be reduced to one store refresh.
    if (refreshHints !== undefined) {
      const partialSlices = refreshHints.seen && !refreshHints.requiresFull
        ? [...refreshHints.slices]
        : []
      // Attached-document uploads/deletes are performed after the transaction mutation has
      // succeeded, so their response headers are not present in the snapshot received from the
      // outbox collector. Include the authoritative Vault slice explicitly.
      if (documentsNeedRefresh && !refreshHints.requiresFull && !partialSlices.includes('documents')) {
        partialSlices.push('documents')
      }
      if (refreshHints.seen && !refreshHints.requiresFull && partialSlices.length === 0) {
        unconfirmedSettingWritesRef.current.clear()
        setError(null)
        isServerAwakeRef.current = true
        return
      }
      await loadAll(
        selectedMonth || undefined,
        selectedYear || undefined,
        true,
        true,
        undefined,
        partialSlices.length > 0 ? partialSlices : undefined,
      )
      unconfirmedSettingWritesRef.current.clear()
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    const onlyInvestments = ops.length > 0 && ops.every(op => op.entity.startsWith('investment'))
    if (onlyInvestments) {
      await awaitInvestmentReconciliation(ops.map(op => op.id))
      setError(null)
      isServerAwakeRef.current = true
      return
    }
    // NOTE: `delete` is intentionally excluded from this wishlist-only fast path.
    // Deleting a *purchased* wishlist item cascade-deletes its linked ledger
    // transaction on the backend (see WishlistService.DeleteWishlistItemAsync),
    // which also shifts dashboard/cycle balances. Refetching only the wishlist
    // would leave that deleted transaction lingering in FE state/cache until a
    // full reload (e.g. undoing a fast add-then-purchase). Route deletes through
    // the full reconcile below instead.
    const onlyWishlistCrud = ops.length > 0 && ops.every(op =>
      op.entity === 'wishlistItem'
      && (op.type === 'add' || op.type === 'update')
    )
    if (onlyWishlistCrud) {
      const wishes = await api.fetchWishlist()
      setWishlist(wishes)
      setCachedJSON(CACHE_KEYS.wishlist, wishes)
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    // Savings goal authoring is ledger-neutral: an earmark is a claim on Rewards money that
    // already exists, so no transaction, dashboard figure or cycle balance can shift. Unlike the
    // wishlist fast path above, `delete` is safe to include here for the same reason — deleting a
    // goal only releases its claim.
    const onlySavingsGoalCrud = ops.length > 0 && ops.every(op =>
      op.entity === 'savingsGoal'
      && (op.type === 'add' || op.type === 'update' || op.type === 'delete')
    )
    if (onlySavingsGoalCrud) {
      const { fetchSavingsGoals } = await import('../../lib/api/savingsGoals')
      const goals = await fetchSavingsGoals()
      setSavingsGoals(goals)
      setCachedJSON(CACHE_KEYS.savingsGoals, goals)
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    // Loan terms are ledger-neutral. Their read model replays the full history returned by the
    // endpoint, so a CRUD-only drain does not need to reload the dashboard or cycle slice.
    const onlyLoanCrud = ops.length > 0 && ops.every(op =>
      op.entity === 'loan' && (op.type === 'add' || op.type === 'update' || op.type === 'delete')
    )
    if (onlyLoanCrud) {
      await loanData.refresh()
      const refreshedPayments = await api.fetchRecurringPayments()
      setRecurringPayments(refreshedPayments)
      setCachedJSON(CACHE_KEYS.recurringPayments, refreshedPayments)
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    const onlyLedgerAccountCrud = ops.length > 0 && ops.every(op =>
      op.entity === 'ledgerAccount' && (op.type === 'add' || op.type === 'update' || op.type === 'delete'))
    const accountOpeningChanges = ops.some(op =>
      op.entity === 'ledgerAccount' && op.type === 'add' && Number(op.payload?.openingAmount ?? 0) !== 0)
    if (onlyLedgerAccountCrud && !accountOpeningChanges) {
      const { fetchLedgerAccounts } = await import('../../lib/api/accounts')
      const refreshedAccounts = await fetchLedgerAccounts()
      setAccounts(refreshedAccounts)
      setCachedJSON(CACHE_KEYS.accounts, refreshedAccounts)
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    const onlyCategoryAdds = ops.length > 0 && ops.every(op =>
      op.entity === 'category' && op.type === 'add'
    )
    if (onlyCategoryAdds) {
      const categories = await api.fetchCategories()
      setCategoriesList(categories)
      setCachedJSON(CACHE_KEYS.categories, categories)
      setError(null)
      isServerAwakeRef.current = true
      return
    }

    // Transactions, recurring payments, purchases, category deletion, and
    // full settings updates can affect multiple derived dashboard values.
    // Reconcile those together and propagate any failure so completed
    // optimistic operations remain projected until a later successful fetch.
    // A defined hint summary returned through the compatibility branch above. Reaching this
    // legacy fallback therefore proves the server supplied no usable refresh metadata.
    const partialSlices: RefreshSlice[] = []
    const canUsePartialRefresh = false
    // A missing header is the mixed-version signal: the API may predate the refresh contract, so
    // retain the established full bootstrap fallback. A malformed/unknown header is handled the
    // same way by the parser (requiresFull=true).
    await loadAll(
      selectedMonth || undefined,
      selectedYear || undefined,
      true,
      true,
      undefined,
      canUsePartialRefresh ? partialSlices : undefined,
    )
    if (loanData.hasLoadedFromServer
      && !partialSlices.includes('loans')
      && ops.some(op => op.entity === 'transaction' || op.entity === 'recurringPayment' || op.entity === 'recurringOccurrence')) {
      await loanData.refresh()
    }
    if (ops.some(op => op.entity.startsWith('investment')) || partialSlices.includes('investments')) {
      await awaitInvestmentReconciliation(ops.map(op => op.id))
    }
    if (documentsNeedRefresh || partialSlices.includes('documents')) {
      await awaitDocumentReconciliation()
    }
    unconfirmedSettingWritesRef.current.clear()
    setError(null)
    isServerAwakeRef.current = true
  }
}
