import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Transaction } from '../../../types'
import { getCycleRangeDates, formatDateForApi, MONTH_NAMES } from '../../../lib/cycle'
import { matchesTransactionFilters, splitFilterSelections } from '../../../lib/transactionFilters'
import { compareTransactions, type TransactionSort } from '../../../lib/transactionOrdering'
import { getLedgerTransactionRowElement } from '../../../lib/ledgerTransactionTarget'
import { createLedgerSyncStatus } from './ledgerSyncStatus'
import { useHighlightedElement } from '../../ui/useHighlightedElement'
import {
  type UseLedgerViewOptions,
  parseAmountFilter,
  laterDate,
  earlierDate,
} from './ledgerViewTypes'
import { useLedgerDeleteModal } from './useLedgerDeleteModal'
import { useLedgerExport } from './useLedgerExport'
import { useLedgerServerData } from './useLedgerServerData'
import { useLedgerFilters } from './useLedgerFilters'

export type { UseLedgerViewOptions }

export function useLedgerView(options: UseLedgerViewOptions) {
  const {
    transactions,
    accounts,
    categories,
    selectedMonth,
    selectedYear,
    cycleDay,
    isMobile,
    incomingCategory,
    incomingFilters,
    incomingSearch,
    incomingSearchMode,
    incomingDate,
    incomingStartDate,
    incomingEndDate,
    incomingMinAmount,
    incomingMaxAmount,
    incomingRecurringFilter,
    incomingWishlistFilter,
    incomingTxType,
    highlightedTxId,
    isSwitchingCycle,
    onClearIncomingFilters,
    onClearHighlightedTx,
    showAllCycles,
    cyclesRange,
    onRouteStateChange,
    onFetchPagedTransactions,
    onExportTransactions,
    onShowAlert,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
    onDeleteTransaction,
    onAiExportRequestConsumed,
    aiExportRequest,
    hideSensitive,
    sensitivePreferenceStatus,
    formRef,
    preferredPageSize,
    preferredSortOrder,
  } = options

  // Pagination states
  const [currentPage, setCurrentPage] = useState(() => {
    if (highlightedTxId) {
      const index = transactions.findIndex(t => t.id === highlightedTxId)
      if (index !== -1) {
        return Math.floor(index / 10) + 1
      }
    }
    return 1
  })
  const [currentCyclePageSize, setCurrentCyclePageSize] = useState(preferredPageSize ?? 10)
  const [allCyclesPageSize, setAllCyclesPageSize] = useState(10)
  const pageSize = showAllCycles ? allCyclesPageSize : currentCyclePageSize
  const setPageSize = useCallback((size: number) => {
    if (showAllCycles) setAllCyclesPageSize(size)
    else setCurrentCyclePageSize(size)
  }, [showAllCycles])
  const [sortOrder, setSortOrder] = useState<TransactionSort>(preferredSortOrder ?? 'date-desc')

  const filterState = useLedgerFilters({
    categories,
    incomingCategory,
    incomingFilters,
    incomingSearch,
    incomingSearchMode,
    incomingDate,
    incomingStartDate,
    incomingEndDate,
    incomingMinAmount,
    incomingMaxAmount,
    incomingRecurringFilter,
    incomingWishlistFilter,
    incomingTxType,
    highlightedTxId,
    showAllCycles,
    cyclesRange,
    onClearIncomingFilters,
    onRouteStateChange,
    setCurrentPage,
  })

  const serverData = useLedgerServerData({
    showAllCycles,
    cyclesRange,
    selectedMonth,
    selectedYear,
    cycleDay,
    allCyclesPageSize,
    pageSize,
    currentPage,
    setCurrentPage,
    sortOrder,
    activeSyncId,
    deletingTxId,
    onFetchPagedTransactions,
    incomingCategory,
    incomingFilters,
    incomingSearch,
    incomingDate,
    incomingStartDate,
    incomingEndDate,
    incomingMinAmount,
    incomingMaxAmount,
    incomingRecurringFilter,
    incomingWishlistFilter,
    incomingTxType,
    appliedSearch: filterState.appliedSearch,
    appliedSearchMode: filterState.appliedSearchMode,
    appliedFilters: filterState.appliedFilters,
    appliedStartDate: filterState.appliedStartDate,
    appliedEndDate: filterState.appliedEndDate,
    appliedMinAmount: filterState.appliedMinAmount,
    appliedMaxAmount: filterState.appliedMaxAmount,
    appliedRecurringFilter: filterState.appliedRecurringFilter,
    appliedWishlistFilter: filterState.appliedWishlistFilter,
    appliedTxTypeFilter: filterState.appliedTxTypeFilter,
    setPendingSearchTerm: filterState.setPendingSearchTerm,
    setPendingFilters: filterState.setPendingFilters,
    setPendingStartDate: filterState.setPendingStartDate,
    setPendingEndDate: filterState.setPendingEndDate,
    setPendingMinAmount: filterState.setPendingMinAmount,
    setPendingMaxAmount: filterState.setPendingMaxAmount,
    setPendingRecurringFilter: filterState.setPendingRecurringFilter,
    setPendingWishlistFilter: filterState.setPendingWishlistFilter,
    setPendingTxTypeFilter: filterState.setPendingTxTypeFilter,
    setAppliedSearch: filterState.setAppliedSearch,
    setAppliedFilters: filterState.setAppliedFilters,
    setAppliedStartDate: filterState.setAppliedStartDate,
    setAppliedEndDate: filterState.setAppliedEndDate,
    setAppliedMinAmount: filterState.setAppliedMinAmount,
    setAppliedMaxAmount: filterState.setAppliedMaxAmount,
    setAppliedRecurringFilter: filterState.setAppliedRecurringFilter,
    setAppliedWishlistFilter: filterState.setAppliedWishlistFilter,
    setAppliedTxTypeFilter: filterState.setAppliedTxTypeFilter,
  })

  const { isDeleting: isTxDeleting, isSyncing: isTxSyncing } = useMemo(() => createLedgerSyncStatus({
    transactions,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
  }), [activeSyncId, activeSyncIds, deletingTxId, transactions])

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.isPendingSync || serverData.recentlySyncedIds.has(String(t.id)))
  }, [transactions, serverData.recentlySyncedIds])

  const filteredPendingTransactions = useMemo(() => {
    if (!showAllCycles) return []

    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(filterState.appliedFilters)

    return pendingTransactions.filter(t => {
      return matchesTransactionFilters(t, {
        search: filterState.appliedSearch,
        searchMode: filterState.appliedSearchMode,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: filterState.appliedTxTypeFilter,
        startDate: laterDate(serverData.allCyclesRange?.startDate, filterState.appliedStartDate),
        endDate: earlierDate(serverData.allCyclesRange?.endDate, filterState.appliedEndDate),
        minAmount: parseAmountFilter(filterState.appliedMinAmount),
        maxAmount: parseAmountFilter(filterState.appliedMaxAmount),
        recurringFilter: filterState.appliedRecurringFilter,
        wishlistFilter: filterState.appliedWishlistFilter,
      })
    }).sort((a, b) => compareTransactions(a, b, sortOrder))
  }, [pendingTransactions, showAllCycles, filterState.appliedSearch, filterState.appliedFilters, filterState.appliedTxTypeFilter, serverData.allCyclesRange, filterState.appliedStartDate, filterState.appliedEndDate, filterState.appliedMinAmount, filterState.appliedMaxAmount, filterState.appliedRecurringFilter, filterState.appliedWishlistFilter, sortOrder])

  const filteredTransactions = useMemo(() => {
    const { buckets: selectedBuckets, categories: selectedCategories } = splitFilterSelections(filterState.selectedFilters)
    const activeMonthIndex = MONTH_NAMES.indexOf(selectedMonth) + 1
    const activeCycleRange = activeMonthIndex > 0
      ? getCycleRangeDates(selectedYear, activeMonthIndex, cycleDay)
      : null
    const cycleStartDate = activeCycleRange ? formatDateForApi(activeCycleRange.start) : undefined
    const cycleEndDate = activeCycleRange ? formatDateForApi(activeCycleRange.end) : undefined

    return transactions.filter(t => matchesTransactionFilters(t, {
        search: filterState.searchTerm,
        searchMode: filterState.searchMode,
        buckets: selectedBuckets,
        categories: selectedCategories,
        txType: filterState.selectedTxTypeFilter,
        startDate: laterDate(cycleStartDate, filterState.selectedStartDate),
        endDate: earlierDate(cycleEndDate, filterState.selectedEndDate),
        minAmount: parseAmountFilter(filterState.selectedMinAmount),
        maxAmount: parseAmountFilter(filterState.selectedMaxAmount),
        recurringFilter: filterState.selectedRecurringFilter,
        wishlistFilter: filterState.selectedWishlistFilter,
      })).sort((a, b) => compareTransactions(a, b, sortOrder))
  }, [transactions, filterState.searchTerm, filterState.selectedFilters, filterState.selectedTxTypeFilter, filterState.selectedStartDate, filterState.selectedEndDate, filterState.selectedMinAmount, filterState.selectedMaxAmount, filterState.selectedRecurringFilter, filterState.selectedWishlistFilter, selectedMonth, selectedYear, cycleDay, sortOrder])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  const displayTransactions = useMemo(() => {
    if (showAllCycles) {
      if (!serverData.serverResult || serverData.serverIsReplacingRows) return []
      const syncingIds = new Set(filteredPendingTransactions.map(transaction => String(transaction.id)))
      return serverData.serverResult.items.filter(transaction => !syncingIds.has(String(transaction.id)))
    }
    return paginatedTransactions
  }, [showAllCycles, serverData.serverResult, serverData.serverIsReplacingRows, filteredPendingTransactions, paginatedTransactions])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  useEffect(() => {
    if (!showAllCycles && currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, showAllCycles, currentPage])

  useEffect(() => {
    if (showAllCycles && serverData.serverResult) {
      const serverTotalPages = Math.ceil(serverData.serverResult.total / pageSize) || 1
      if (currentPage > serverTotalPages) {
        setCurrentPage(serverTotalPages)
      }
    }
  }, [serverData.serverResult, showAllCycles, currentPage, pageSize])

  // Page selection for highlighted transaction (if target is on a different page)
  useEffect(() => {
    if (!highlightedTxId) return
    const index = filteredTransactions.findIndex(t => t.id === highlightedTxId)
    if (index !== -1) {
      const targetPage = Math.floor(index / pageSize) + 1
      setCurrentPage(prev => (prev !== targetPage ? targetPage : prev))
    }
  }, [highlightedTxId, filteredTransactions, pageSize])

  useHighlightedElement(highlightedTxId ?? null, onClearHighlightedTx, {
    ready: !isSwitchingCycle,
    resolveElement: () => highlightedTxId
      ? getLedgerTransactionRowElement(highlightedTxId, isMobile)
      : null,
  })

  const deleteModal = useLedgerDeleteModal({
    hideSensitive,
    sensitivePreferenceStatus,
    onDeleteTransaction,
    onShowAlert,
    formRef,
  })

  const exportState = useLedgerExport({
    hideSensitive,
    showAllCycles,
    cyclesRange,
    selectedMonth,
    selectedYear,
    cycleDay,
    accounts,
    appliedFilters: filterState.appliedFilters,
    appliedSearch: filterState.appliedSearch,
    appliedSearchMode: filterState.appliedSearchMode,
    appliedStartDate: filterState.appliedStartDate,
    appliedEndDate: filterState.appliedEndDate,
    appliedMinAmount: filterState.appliedMinAmount,
    appliedMaxAmount: filterState.appliedMaxAmount,
    appliedRecurringFilter: filterState.appliedRecurringFilter,
    appliedWishlistFilter: filterState.appliedWishlistFilter,
    appliedTxTypeFilter: filterState.appliedTxTypeFilter,
    sortOrder,
    allCyclesRange: serverData.allCyclesRange,
    serverResult: serverData.serverResult,
    serverIsReplacingRows: serverData.serverIsReplacingRows,
    displayTransactions,
    paginatedTransactions,
    filteredTransactions,
    filteredPendingTransactions,
    onExportTransactions,
    onShowAlert,
    onAiExportRequestConsumed,
    aiExportRequest,
    currentPage,
  })

  // Reset back to page 1 when search inputs or active filters are updated (client-side mode only)
  const prevFilterSignatureRef = useRef<string | null>(null)
  useEffect(() => {
    const currentSignature = JSON.stringify([
      filterState.searchTerm, filterState.selectedFilters, filterState.selectedStartDate, filterState.selectedEndDate,
      filterState.selectedMinAmount, filterState.selectedMaxAmount, filterState.selectedRecurringFilter,
      filterState.selectedWishlistFilter, filterState.selectedTxTypeFilter, showAllCycles,
    ])
    if (prevFilterSignatureRef.current === null) {
      prevFilterSignatureRef.current = currentSignature
      return
    }
    if (prevFilterSignatureRef.current !== currentSignature) {
      prevFilterSignatureRef.current = currentSignature
      if (!showAllCycles) {
        setCurrentPage(1)
      }
    }
  }, [filterState.searchTerm, filterState.selectedFilters, filterState.selectedStartDate, filterState.selectedEndDate, filterState.selectedMinAmount, filterState.selectedMaxAmount, filterState.selectedRecurringFilter, filterState.selectedWishlistFilter, filterState.selectedTxTypeFilter, showAllCycles])

  const onStartEditStable = useCallback((t: Transaction) => formRef.current?.handleStartEdit(t), [formRef])
  const onAddTransactionStable = useCallback(() => formRef.current?.openFresh(), [formRef])

  return {
    ...filterState,
    currentPage, setCurrentPage, pageSize, setPageSize, sortOrder, setSortOrder,
    serverResult: serverData.serverResult,
    serverIsFetching: serverData.serverIsFetching,
    serverIsReplacingRows: serverData.serverIsReplacingRows,
    serverError: serverData.serverError,
    retryServerFetch: serverData.retryServerFetch,
    showExportModal: exportState.showExportModal,
    setShowExportModal: exportState.setShowExportModal,
    exportIsFetching: exportState.exportIsFetching,
    syncingTransactions: filteredPendingTransactions,
    hasMatchingPendingTransactions: filteredPendingTransactions.length > 0,
    showDeleteModal: deleteModal.showDeleteModal,
    txToDelete: deleteModal.txToDelete,
    attachedDocumentCount: deleteModal.attachedDocumentIds.length,
    alsoDeleteDocuments: deleteModal.alsoDeleteDocuments,
    setAlsoDeleteDocuments: deleteModal.setAlsoDeleteDocuments,
    areAttachedDocumentsLoading: deleteModal.areAttachedDocumentsLoading,
    showEditDisabledModal: deleteModal.showEditDisabledModal,
    setShowEditDisabledModal: deleteModal.setShowEditDisabledModal,
    editBlockedTransaction: deleteModal.editBlockedTransaction,
    displayTransactions, totalPages, filteredTransactions, isTxDeleting, isTxSyncing,
    onStartEditStable, onAddTransactionStable,
    onDeleteClickStable: deleteModal.onDeleteClickStable,
    onEditBlockedStable: deleteModal.onEditBlockedStable,
    handleDeleteClick: deleteModal.handleDeleteClick,
    handleConfirmDelete: deleteModal.handleConfirmDelete,
    handleCancelDelete: deleteModal.handleCancelDelete,
    handleExportPage: exportState.handleExportPage,
    handleExportAll: exportState.handleExportAll,
  }
}
