import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useOptimisticList } from '../lib/useOptimisticList'
import { useOutbox } from '../lib/useOutbox'
import { useStartupSync } from './useStartupSync'
import type { EntityKind, OpType, OutboxPayload, QueuedOp } from '../lib/outbox'
import type { SuccessfulSyncOp } from '../lib/outboxSync'
import { formatCurrencyVal, SENSITIVE_AMOUNT_MASK } from '../lib/utils'
import { useFinancialBaseData } from './financialData/useFinancialBaseData'
import { useSessionRestore } from './financialData/useSessionRestore'
import { useLoadAll } from './financialData/useLoadAll'
import { useProjectedFinancialData } from './financialData/useProjectedFinancialData'
import { useFinancialDomainActions } from './financialData/useFinancialDomainActions'
import { createOutboxRefreshHandler } from './financialData/useOutboxRefresh'
import { useDirectSyncState } from './financialData/useDirectSyncState'
import { useDraftTransactionsState } from './financialData/useDraftTransactionsState'
import { useAccountPlacementReview } from './financialData/useAccountPlacementReview'
import {
  createLocalId,
  PERSISTED_SETTING_KEYS,
  queuedTransactionDeleteCoversTarget,
  type UseFinancialDataOptions,
} from './financialData/financialDataTypes'

export { queuedTransactionDeleteCoversTarget }
export type { UseFinancialDataOptions }

export function useFinancialData(options: Omit<UseFinancialDataOptions, 'usernameRef' | 'setIsSwitchingCycle'>) {
  const {
    dashboardData,
    setDashboardData,
    transactions,
    setTransactions,
    recurringPayments,
    setRecurringPayments,
    categoriesList,
    setCategoriesList,
    walletBalance,
    setWalletBalance,
    wishlist,
    setWishlist,
    savingsGoals,
    setSavingsGoals,
    accounts,
    setAccounts,
    loanData,
    autocompleteSuggestions,
    setAutocompleteSuggestions,
  } = useFinancialBaseData()

  const {
    token,
    username,
    lastUnlockedTimeRef,
    isLocked,
    markSessionLocked,
    handleLogout,
    hideSensitive,
    darkMode,
    showToast,
    guardSensitive,
    setConfirmModalData,
    onRequestSensitiveReveal,
    resolveHideSensitive,
    markSensitivePreferenceUnavailable,
    setDarkMode,
    notifyOnLogin,
    loadAllAbortRef,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    setHasShownModalThisSession,
    hasShownModalThisSession,
    setShowLoginModal,
    setShowFailedOpsModal,
  } = options

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(() => dashboardData === null)
  const [isOffline, setIsOffline] = useState<boolean>(() => typeof navigator !== 'undefined' ? !navigator.onLine : false)

  const isServerAwakeRef = useRef<boolean>(false)
  const isFinancialDataMountedRef = useRef(true)
  const loadAllSeqRef = useRef(0)
  // Keep each locally chosen setting until a server snapshot explicitly confirms the
  // same value. Queue state alone is insufficient here: a fast settings write can leave
  // the outbox before an older, slower bootstrap response commits.
  const unconfirmedSettingWritesRef = useRef(new Map<string, unknown>())

  const {
    draftTransactions,
    setDraftTransactions,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    stageTransactionDocumentChanges,
  } = useDraftTransactionsState()

  useEffect(() => {
    unconfirmedSettingWritesRef.current.clear()
  }, [token])

  useEffect(() => {
    isFinancialDataMountedRef.current = true
    return () => {
      isFinancialDataMountedRef.current = false
      loadAllSeqRef.current += 1
      loadAllAbortRef.current?.abort()
      loadAllAbortRef.current = null
    }
  }, [loadAllAbortRef])

  const toOutboxPayload = (value: object): OutboxPayload => ({ ...value })

  const {
    directSyncIds,
    setDirectSyncIds,
    pendingLedgerTransactions,
    setPendingLedgerTransactions,
    beginDirectSync,
    endDirectSync,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    removePendingLedgerTransaction,
  } = useDirectSyncState()

  const loadAllRef = useRef<ReturnType<typeof useLoadAll>>(() => Promise.resolve())
  const getPendingOpsRef = useRef<() => QueuedOp[]>(() => [])

  const outboxRefresh = useCallback(async (successfulOps: ReadonlyArray<SuccessfulSyncOp>) => {
    const handler = createOutboxRefreshHandler({
      pendingTransactionDocumentsRef,
      pendingTransactionDocumentDeletesRef,
      showToast,
      getPendingOps: () => getPendingOpsRef.current(),
      setError,
      isServerAwakeRef,
      setWishlist,
      setSavingsGoals,
      loanData,
      setRecurringPayments,
      setAccounts,
      setCategoriesList,
      loadAll: (...args) => loadAllRef.current(...args),
      selectedMonth,
      selectedYear,
      unconfirmedSettingWritesRef,
    })
    await handler(successfulOps)
  }, [loanData, selectedMonth, selectedYear, setError, setWishlist, setSavingsGoals, setRecurringPayments, setAccounts, setCategoriesList, showToast])

  const {
    pendingOps,
    failedOps,
    activeOps,
    isBackgroundSyncing,
    activeSyncId: outboxActiveSyncId,
    deletingId: deletingTxId,
    syncCountdownMs,
    editingPendingId,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    processQueue,
    setBackgroundSyncing: setIsBackgroundSyncing,
    setDeletingId: setDeletingTxId,
    setEditingPendingId,
    discardFailedOp,
    discardAllFailedOps,
    getPendingOps,
    getActiveOps,
    getFailedOps,
    mutateFailedOps,
    reset: resetOutbox,
  } = useOutbox({
    token: isLocked ? null : token,
    lastUnlockedTimeRef,
    setError,
    showToast,
    onViewFailedOps: () => setShowFailedOpsModal(true),
    onAuthError: handleLogout,
    onLockError: markSessionLocked,
    onRequestSensitiveReveal,
    refresh: outboxRefresh,
  })

  useEffect(() => {
    getPendingOpsRef.current = getPendingOps
  }, [getPendingOps])

  const queueMutation = useCallback((
    entity: EntityKind,
    type: OpType,
    targetId: string,
    payload?: OutboxPayload,
    isUndo?: boolean,
  ) => {
    if (entity === 'transaction' && type === 'bulkDelete') {
      const transactionIds = payload?.transactionIds
      if (Array.isArray(transactionIds)) {
        for (const transactionId of transactionIds) {
          if (typeof transactionId === 'string') pendingTransactionDocumentsRef.current.delete(transactionId)
        }
      }
    }
    mutateQueue(previous => enqueue(previous, entity, type, targetId, payload, isUndo))
    return true
  }, [enqueue, mutateQueue])

  useEffect(() => {
    if (!token) return
    // Bootstrap and outbox replay run concurrently. Seed the same protection
    // used by in-session setting edits from persisted operations so a successful
    // replay cannot let an older server snapshot overwrite the local cache.
    for (const operation of pendingOps) {
      if (operation.entity !== 'settings' || operation.type !== 'update' || !operation.payload) continue
      for (const key of PERSISTED_SETTING_KEYS) {
        const value = operation.payload[key]
        if (value !== undefined) unconfirmedSettingWritesRef.current.set(key, value)
      }
    }
  }, [pendingOps, token])

  const activeQueueOperationIds = useMemo(() => outboxActiveSyncId
    ? activeOps
      .filter(op => op.targetId === outboxActiveSyncId && !op.isCompleted)
      .map(op => op.id)
    : [], [activeOps, outboxActiveSyncId])
  const activeSyncIds = useMemo(() => Array.from(new Set([
    ...(outboxActiveSyncId ? [outboxActiveSyncId] : []),
    ...activeQueueOperationIds,
    ...directSyncIds,
  ])), [activeQueueOperationIds, directSyncIds, outboxActiveSyncId])
  const activeSyncId = activeSyncIds[0] || null

  // Fetch initial ledger and dashboard statistics
  const loadAll = useLoadAll({
    token,
    notifyOnLogin,
    hasShownModalThisSession,
    getActiveOps,
    getFailedOps,
    handleLogout,
    markSessionLocked,
    markSensitivePreferenceUnavailable,
    resolveHideSensitive,
    setDarkMode,
    isFinancialDataMountedRef,
    isServerAwakeRef,
    lastUnlockedTimeRef,
    loadAllAbortRef,
    loadAllSeqRef,
    unconfirmedSettingWritesRef,
    setDashboardData,
    setTransactions,
    setRecurringPayments,
    setCategoriesList,
    setWishlist,
    setSavingsGoals,
    setAccounts,
    setWalletBalance,
    setAutocompleteSuggestions,
    setLoading,
    setIsBackgroundSyncing,
    setError,
    setSelectedMonth,
    setSelectedYear,
    setHasShownModalThisSession,
    setShowLoginModal,
  })
  useEffect(() => {
    loadAllRef.current = loadAll
  }, [loadAll])

  // Backup outbox/drafts on logout
  const { handleLogoutCleanup, handleLoginSuccessRestore } = useSessionRestore({
    draftTransactions,
    loanReset: loanData.reset,
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
  })

  const wakeUpAndSync = useStartupSync({
    token,
    isServerAwakeRef,
    loadAll,
    processQueue,
    setIsOffline,
  })

  const {
    optimisticDashboardData,
    allTransactions,
    allWishlist,
    allSavingsGoals,
    allAccounts,
    optimisticDashboardWithAccounts,
    allLoans,
    allRecurringPayments,
  } = useProjectedFinancialData({
    activeOps,
    selectedMonth,
    selectedYear,
    dashboardData,
    transactions,
    pendingLedgerTransactions,
    recurringPayments,
    wishlist,
    savingsGoals,
    accounts,
    loanData,
  })

  const { resolveAccountPlacementOps, retryFailedOp } = useAccountPlacementReview({
    token,
    allAccounts,
    allRecurringPayments,
    getPendingOps,
    getFailedOps,
    mutateQueue,
    mutateFailedOps,
    showToast,
    processQueue,
  })

  const allCategories = useOptimisticList(categoriesList, activeOps, 'category')

  const formatSensitive = useCallback((val: number) => {
    const formatted = formatCurrencyVal(val, optimisticDashboardData?.setting?.currency || 'USD')
    return hideSensitive ? SENSITIVE_AMOUNT_MASK : formatted
  }, [hideSensitive, optimisticDashboardData?.setting?.currency])

  const totalBalance = walletBalance ?? allTransactions.reduce((acc, t) => acc + t.amount, 0)

  const domainActions = useFinancialDomainActions({
    darkMode,
    hideSensitive,
    dashboardData,
    guardSensitive,
    mutateQueue,
    unconfirmedSettingWritesRef,
    setDashboardData,
    categoriesList,
    allCategories,
    allRecurringPayments,
    snapshotForUndo,
    setConfirmModalData,
    showToast,
    username,
    selectedMonth,
    selectedYear,
    editingPendingId,
    draftTransactions,
    allTransactions,
    allSavingsGoals,
    createLocalId,
    stageTransactionDocumentChanges,
    loadAll,
    beginDirectSync,
    endDirectSync,
    removePendingLedgerTransaction,
    pendingTransactionDocumentsRef,
    pendingTransactionDocumentDeletesRef,
    setDraftTransactions,
    setDeletingTxId,
    setEditingPendingId,
    formatSensitive,
    toOutboxPayload,
    wishlist,
    savingsGoals,
    allWishlist,
    currency: optimisticDashboardWithAccounts?.setting?.currency || 'USD',
    enqueue,
    setSavingsGoals,
    addPendingLedgerTransaction,
    replacePendingLedgerTransaction,
    allLoans,
    allAccounts,
  })

  return {
    transactions,
    allTransactions,
    recurringPayments,
    allRecurringPayments,
    categoriesList,
    allCategories,
    wishlist,
    allWishlist,
    savingsGoals,
    allSavingsGoals,
    accounts,
    allAccounts,
    loans: loanData.loans,
    allLoans,
    loanLoadStatus: loanData.status,
    hasLoadedLoans: loanData.hasLoadedFromServer,
    loadLoans: loanData.load,
    refreshLoans: loanData.refresh,
    dashboardData,
    optimisticDashboardData: optimisticDashboardWithAccounts,
    walletBalance,
    totalBalance,
    autocompleteSuggestions,
    error,
    setError,
    loading,
    setLoading,
    isOffline,
    setIsOffline,
    isBackgroundSyncing,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
    setDeletingTxId,
    syncCountdownMs,
    editingPendingId,
    setEditingPendingId,
    pendingOps,
    failedOps,
    activeOps,
    enqueue,
    queueMutation,
    mutateQueue,
    snapshotForUndo,
    processQueue,
    discardFailedOp,
    discardAllFailedOps,
    retryFailedOp,
    resolveAccountPlacementOps,
    setTransactions,
    setDashboardData,
    loadAll,
    draftTransactions,
    setDraftTransactions,
    handleLogoutCleanup,
    handleLoginSuccessRestore,
    wakeUpAndSync,
    formatSensitive,
    ...domainActions,
  }
}
