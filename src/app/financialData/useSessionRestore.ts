import { useCallback } from 'react'
import type { DashboardData, LedgerAccount, RecurringPayment, SavingsGoal, Transaction, TransactionCategory, TransactionDocumentChanges, WishlistItem } from '../../types'
import { CACHE_KEYS, sanitizeTransactions, setCachedJSON } from '../../lib/cache'
import { backupModalDraftsOnLogout, clearAllModalDrafts, restoreModalDraftsOnLogin } from '../../lib/modalDrafts'
import { sanitizeQueuedOps } from '../../lib/outbox'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'

interface SessionRestoreDependencies {
  draftTransactions: Transaction[]
  loanReset: () => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  getPendingOps: UseOutboxResult['getPendingOps']
  getFailedOps: UseOutboxResult['getFailedOps']
  mutateQueue: UseOutboxResult['mutateQueue']
  resetOutbox: UseOutboxResult['reset']
  loadAllSeqRef: React.MutableRefObject<number>
  loadAllAbortRef: React.MutableRefObject<AbortController | null>
  isServerAwakeRef: React.MutableRefObject<boolean>
  pendingTransactionDocumentsRef: React.MutableRefObject<Map<string, TransactionDocumentChanges>>
  pendingTransactionDocumentDeletesRef: React.MutableRefObject<Map<string, number[]>>
  setDashboardData: React.Dispatch<React.SetStateAction<DashboardData | null>>
  setWalletBalance: React.Dispatch<React.SetStateAction<number | null>>
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setRecurringPayments: React.Dispatch<React.SetStateAction<RecurringPayment[]>>
  setDraftTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setCategoriesList: React.Dispatch<React.SetStateAction<TransactionCategory[]>>
  setWishlist: React.Dispatch<React.SetStateAction<WishlistItem[]>>
  setSavingsGoals: React.Dispatch<React.SetStateAction<SavingsGoal[]>>
  setAccounts: React.Dispatch<React.SetStateAction<LedgerAccount[]>>
  setDirectSyncIds: React.Dispatch<React.SetStateAction<string[]>>
  setPendingLedgerTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  setSelectedMonth: (month: string) => void
  setSelectedYear: (year: number) => void
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

/**
 * Sign-out teardown and the matching sign-in restore. They are a pair: logout backs the unsynced
 * queue, drafts and modal state up under the outgoing owner, and login only consumes a backup
 * whose owner matches, so one account can never inherit another's unsent work.
 */
export function useSessionRestore(deps: SessionRestoreDependencies) {
  const {
    draftTransactions,
    loanReset,
    showToast,
    getPendingOps,
    getFailedOps,
    mutateQueue,
    resetOutbox,
    loadAllSeqRef,
    loadAllAbortRef,
    isServerAwakeRef,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    setDashboardData,
    setWalletBalance,
    setTransactions,
    setRecurringPayments,
    setDraftTransactions,
    setCategoriesList,
    setWishlist,
    setSavingsGoals,
    setAccounts,
    setDirectSyncIds,
    setPendingLedgerTransactions,
    setSelectedMonth,
    setSelectedYear,
    setLoading,
    setError,
  } = deps
  const handleLogoutCleanup = useCallback(async (currentOwner: string, createBackup = true) => {
    // A new login must perform its own wake-up and initial fetch. Also invalidate
    // the outgoing session's request so its finally block cannot hide the next
    // session's loading skeleton after logout.
    loadAllSeqRef.current += 1
    loadAllAbortRef.current?.abort()
    loadAllAbortRef.current = null
    isServerAwakeRef.current = false

    const currentPending = getPendingOps()
    const currentDrafts = draftTransactions
    const currentFailed = getFailedOps()

    if (createBackup) {
      let backupFailed = false
      const tryBackup = (key: string, value: unknown) => {
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch (backupError) {
          backupFailed = true
          console.error(`Could not back up ${key} during logout.`, backupError)
        }
      }

      if (currentPending.length > 0) {
        tryBackup('pending_operations_backup', { owner: currentOwner, ops: currentPending })
      }
      if (currentDrafts.length > 0) {
        tryBackup('draft_transactions_backup', { owner: currentOwner, transactions: currentDrafts })
      }
      if (currentFailed.length > 0) {
        tryBackup('failed_operations_backup', { owner: currentOwner, ops: currentFailed })
      }

      try {
        backupModalDraftsOnLogout(currentOwner)
      } catch (backupError) {
        backupFailed = true
        console.error('Could not back up modal drafts during logout.', backupError)
      }

      if (backupFailed) {
        showToast(
          'Some unsynced local changes could not be backed up, but sign-out will continue.',
          'Local backup unavailable',
          'warning',
        )
      }
    }

    setDashboardData(null)
    setWalletBalance(null)
    setTransactions([])
    setRecurringPayments([])
    resetOutbox()
    setDraftTransactions([])
    pendingTransactionDocumentsRef.current.clear()
    pendingTransactionDocumentDeletesRef.current.clear()
    setCategoriesList([])
    setWishlist([])
    setSavingsGoals([])
    setAccounts([])
    loanReset()
    setDirectSyncIds([])
    setPendingLedgerTransactions([])
    setSelectedMonth('')
    setSelectedYear(0)
    setLoading(true)

    // Clear LocalStorage cache
    for (const key of [
      CACHE_KEYS.dashboardData,
      CACHE_KEYS.transactions,
      CACHE_KEYS.recurringPayments,
      CACHE_KEYS.categories,
      CACHE_KEYS.wishlist,
      CACHE_KEYS.savingsGoals,
      CACHE_KEYS.accounts,
      CACHE_KEYS.loans,
      CACHE_KEYS.walletBalance,
      CACHE_KEYS.pendingTransactions,
      CACHE_KEYS.pendingOperations,
      'failed_operations',
      'draft_transactions',
    ]) {
      try {
        localStorage.removeItem(key)
      } catch (storageError) {
        console.warn(`Could not remove local storage key ${key}.`, storageError)
      }
    }
    try {
      clearAllModalDrafts()
    } catch (storageError) {
      console.warn('Could not clear modal drafts.', storageError)
    }
  }, [getPendingOps, getFailedOps, draftTransactions, resetOutbox, setSelectedMonth, setSelectedYear, showToast])

  // Restore backups on login
  const handleLoginSuccessRestore = useCallback((newUsername: string) => {
    // The token state update causes wakeUpAndSync to run on the next render. Reset
    // the previous session's wake state and show the foreground skeleton until
    // that first dashboard payload arrives.
    isServerAwakeRef.current = false
    setLoading(true)
    setError(null)

    const cachedOpsBackup = localStorage.getItem('pending_operations_backup') || localStorage.getItem('pending_transactions_backup')
    if (cachedOpsBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedOpsBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpOps = sanitizeQueuedOps(parsed.ops || parsed.transactions)
          if (backedUpOps.length > 0) {
            mutateQueue(() => backedUpOps)
            setCachedJSON(CACHE_KEYS.pendingOperations, backedUpOps)
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up pending operations:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('pending_operations_backup')
        localStorage.removeItem('pending_transactions_backup')
      }
    }

    const cachedDraftBackup = localStorage.getItem('draft_transactions_backup')
    if (cachedDraftBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedDraftBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpDrafts = sanitizeTransactions(parsed.transactions)
          if (backedUpDrafts.length > 0) {
            setDraftTransactions(backedUpDrafts)
            localStorage.setItem('draft_transactions', JSON.stringify(backedUpDrafts))
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up draft transactions:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('draft_transactions_backup')
      }
    }

    const cachedFailedBackup = localStorage.getItem('failed_operations_backup')
    if (cachedFailedBackup) {
      let consumedOrCorrupt = false
      try {
        const parsed = JSON.parse(cachedFailedBackup)
        if (parsed && parsed.owner === newUsername) {
          consumedOrCorrupt = true
          const backedUpFailed = sanitizeQueuedOps(parsed.ops).map(op => ({ ...op, retryCount: 0 }))
          if (backedUpFailed.length > 0) {
            mutateQueue(prev => {
              const merged = [...prev, ...backedUpFailed]
              setCachedJSON(CACHE_KEYS.pendingOperations, merged)
              return merged
            })
          }
        }
      } catch (e) {
        console.error('Failed to parse backed up failed operations:', e)
        consumedOrCorrupt = true
      }
      if (consumedOrCorrupt) {
        localStorage.removeItem('failed_operations_backup')
      }
    }

    restoreModalDraftsOnLogin(newUsername)
  }, [mutateQueue])

  return { handleLogoutCleanup, handleLoginSuccessRestore }
}
