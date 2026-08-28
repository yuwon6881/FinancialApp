import React, { useState, useCallback, useRef } from 'react'
import type {
  ActiveRecurringPayment,
  Transaction,
  TransactionCategory,
  LedgerAccount,
  AutocompleteSuggestion,
  TransactionDocumentChanges,
  CategorySummary,
  SavingsGoal,
} from '../types'
import type { PagedTransactionResult, ReceiptScanResult } from '../lib/api'
import type { LedgerAddPrefill } from '../app/useCycleNavigation'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useAppContext } from '../contexts/AppContext'
import { DeleteTransactionModal, EditDisabledModal } from './ledger/LedgerDeleteModals'
import { LedgerPagination } from './ledger/LedgerPagination'
import { LedgerFilterBar } from './ledger/LedgerFilterBar'
import { LedgerBulkSelectionLayer } from './ledger/LedgerBulkSelectionLayer'
import type { LedgerListProps } from './ledger/ledgerListShared'
import { TransactionFormSheet, type TransactionFormSheetRef } from './ledger/TransactionFormSheet'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../lib/useReceiptSplitPolling'
import { calculateLedgerTotals } from '../lib/ledgerTotals'
import { splitFilterSelections, type TransactionLinkFilter } from '../lib/transactionFilters'
import type { LedgerRouteState } from '../lib/appLocation'
import { useIsExpanded } from '../lib/breakpoints'
import { formatCurrencyVal } from '../lib/utils'
import { SensitiveMask } from './ui/SensitiveAmount'
import { LedgerMoveSheet } from './ledger/LedgerMoveSheet'

// Hooks and sub-components
import { useLedgerView } from './ledger/view/useLedgerView'
import { LedgerToolbar } from './ledger/view/LedgerToolbar'
import { LedgerPendingReviews } from './ledger/LedgerPendingReviews'
import { LedgerBalanceReconciliation } from './ledger/LedgerBalanceReconciliation'
import { LedgerServerStatus } from './ledger/LedgerServerStatus'
import { LedgerActiveFilterSummary } from './ledger/LedgerActiveFilterSummary'
import { getCycleLabelForDropdown } from '../lib/cycleLabels'
import type { StabilityTopUpContext } from './ledger/transaction-form/useTransactionFormOptions'

const LedgerExportModal = React.lazy(() =>
  import('./ledger/LedgerExportModal').then(module => ({ default: module.LedgerExportModal })))

interface LedgerViewProps {
  transactions: Transaction[]
  accounts?: LedgerAccount[]
  autocompleteSuggestions?: AutocompleteSuggestion[]
  onAddTransaction: (
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<string | void> | string | void
  onDeleteTransaction: (id: string, transaction?: Transaction, attachedDocumentIdsToDelete?: number[]) => Promise<void> | void
  onUpdateTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<void> | void
  hideSensitive?: boolean
  maskFinancialFigures?: boolean
  categories: TransactionCategory[]
  selectedMonth: string
  selectedYear: number
  isCurrentCycle?: boolean
  cycleDay: number
  incomingCategory: string | null
  incomingFilters?: string[]
  incomingSearch?: string | null
  incomingSearchMode?: import('../lib/transactionFilters').TransactionSearchMode
  incomingDate?: string | null
  incomingStartDate?: string | null
  incomingEndDate?: string | null
  incomingMinAmount?: string | null
  incomingMaxAmount?: string | null
  incomingRecurringFilter?: TransactionLinkFilter
  incomingWishlistFilter?: TransactionLinkFilter
  incomingReloadFilter?: import('./ledger/view/ledgerViewTypes').LedgerReloadFilter
  incomingAccountIds?: string[]
  incomingTxType?: import('./ledger/view/ledgerViewTypes').LedgerTxType
  highlightedTxId?: string | null
  onClearIncomingFilters?: () => void
  onClearHighlightedTx?: () => void
  showAllCycles: boolean
  onShowAllCyclesChange: (showAllCycles: boolean) => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  onRouteStateChange?: (state: Omit<LedgerRouteState, 'highlightedTxId'>) => void
  ledgerSummaries?: CategorySummary[]
  savingsGoals?: SavingsGoal[]
  activeRecurringPayments?: ActiveRecurringPayment[]
  currency?: string
  autoOpenAddForm?: boolean
  autoOpenTxType?: 'inflow' | 'outflow' | 'transfer' | null
  autoOpenPrefill?: LedgerAddPrefill | null
  onResetAutoOpen?: () => void
  stabilityBalance?: number
  stabilityTarget?: number
  essentialsAlloc?: number
  growthAlloc?: number
  stabilityAlloc?: number
  rewardsAlloc?: number
  stabilityOverflowRedirect?: string
  /** Current-cycle balances and recovery state; the form matches these against its posting date. */
  stabilityTopUpContext?: StabilityTopUpContext
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  onOutsideCycleSave?: (date: string) => void
  activeSyncId?: string | null
  activeSyncIds?: string[]
  deletingTxId?: string | null
  onStartEditPending?: (id: string | null) => void
  isSwitchingCycle?: boolean
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
  onReviewReceiptScan?: () => void
  onAddFormOpenChange?: (open: boolean) => void
  activeScanJobIds?: string[]
  failedScanJob?: { jobId: string; errorMessage: string } | null
  aiEditDraft?: { nonce: number; id: string; changes: Record<string, unknown> } | null
  aiExportRequest?: { nonce: number } | null
  onAiEditDraftConsumed?: () => void
  onAiExportRequestConsumed?: () => void
  autoOpenReceiptSplit?: boolean
  onResetAutoOpenReceiptSplit?: () => void
  receiptSplitDraft?: ReceiptSplitDraft | null
  onReviewReceiptSplit?: () => void
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
  onReceiptSplitCleared?: (scanId: string) => void | Promise<void>
  onReceiptSplitOpenChange?: (open: boolean) => void
  preferredPageSize?: number
  preferredSortOrder?: import('../lib/transactionOrdering').TransactionSort
  onPreferredPageSizeChange?: (size: number) => void
  onPreferredSortOrderChange?: (sort: import('../lib/transactionOrdering').TransactionSort) => void
}

export const LedgerView: React.FC<LedgerViewProps> = (props) => {
  const app = useAppContext()
  const hideSensitive = props.hideSensitive ?? app.hideSensitive
  const maskFinancialFigures = props.maskFinancialFigures ?? app.maskPassiveFinancialFigures
  const currency = props.currency ?? app.currency
  const activeSyncId = props.activeSyncId ?? app.activeSyncId
  const activeSyncIds = props.activeSyncIds
    ?? (props.activeSyncId !== undefined
      ? (props.activeSyncId ? [props.activeSyncId] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingTxId = props.deletingTxId ?? app.deletingId
  const isMobile = !useIsExpanded()

  const formRef = useRef<TransactionFormSheetRef>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [moveTransactions, setMoveTransactions] = useState<Transaction[]>([])
  const handleAddFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open)
    props.onAddFormOpenChange?.(open)
  }, [props.onAddFormOpenChange])
  const ledger = useLedgerView({
    ...props,
    isMobile,
    hideSensitive,
    activeSyncId,
    activeSyncIds,
    operations: app.operations,
    deletingTxId,
    sensitivePreferenceStatus: app.sensitivePreferenceStatus,
    formRef,
  })

  // Selection is page-scoped by construction: the toolbar counts, the select-all checkbox and
  // the eligible-row count all describe the visible page only. Without the page in this key you
  // could select rows on page 1, navigate away, and have Move or Delete act on rows that are no
  // longer on screen and cannot be reviewed.
  const bulkResetKey = JSON.stringify([
    props.showAllCycles,
    props.selectedMonth,
    props.selectedYear,
    ledger.currentPage,
    ledger.pageSize,
    ledger.sortOrder,
    props.showAllCycles ? ledger.appliedSearch : ledger.searchTerm,
    props.showAllCycles ? ledger.appliedFilters : ledger.selectedFilters,
    props.showAllCycles ? ledger.appliedStartDate : ledger.selectedStartDate,
    props.showAllCycles ? ledger.appliedEndDate : ledger.selectedEndDate,
    props.showAllCycles ? ledger.appliedMinAmount : ledger.selectedMinAmount,
    props.showAllCycles ? ledger.appliedMaxAmount : ledger.selectedMaxAmount,
    props.showAllCycles ? ledger.appliedRecurringFilter : ledger.selectedRecurringFilter,
    props.showAllCycles ? ledger.appliedWishlistFilter : ledger.selectedWishlistFilter,
    props.showAllCycles ? ledger.appliedReloadFilter : ledger.selectedReloadFilter,
    props.showAllCycles ? ledger.appliedAccountIds : ledger.selectedAccountIds,
    props.showAllCycles ? ledger.appliedTxTypeFilter : ledger.selectedTxTypeFilter,
    props.showAllCycles ? ledger.pendingSearchTerm : ledger.searchTerm,
    props.showAllCycles ? ledger.pendingFilters : ledger.selectedFilters,
    props.showAllCycles ? ledger.pendingStartDate : ledger.selectedStartDate,
    props.showAllCycles ? ledger.pendingEndDate : ledger.selectedEndDate,
    props.showAllCycles ? ledger.pendingMinAmount : ledger.selectedMinAmount,
    props.showAllCycles ? ledger.pendingMaxAmount : ledger.selectedMaxAmount,
    props.showAllCycles ? ledger.pendingRecurringFilter : ledger.selectedRecurringFilter,
    props.showAllCycles ? ledger.pendingWishlistFilter : ledger.selectedWishlistFilter,
    props.showAllCycles ? ledger.pendingReloadFilter : ledger.selectedReloadFilter,
    props.showAllCycles ? ledger.pendingAccountIds : ledger.selectedAccountIds,
    props.showAllCycles ? ledger.pendingTxTypeFilter : ledger.selectedTxTypeFilter,
    hideSensitive,
  ])
  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return maskFinancialFigures
      ? <SensitiveMask />
      : <span className="transition-[filter] duration-200">{formatCurrency(val)}</span>
  }

  // Only a lone bucket filter gets a net: with two selected the figure would be a sum across
  // buckets that no balance on any screen corresponds to.
  const activeBucketFilter = React.useMemo(() => {
    const { buckets } = splitFilterSelections(
      props.showAllCycles ? ledger.appliedFilters : ledger.selectedFilters)
    return buckets.length === 1 ? buckets[0] : null
  }, [props.showAllCycles, ledger.appliedFilters, ledger.selectedFilters])
  const pageTotals = React.useMemo(
    () => calculateLedgerTotals(ledger.displayTransactions, activeBucketFilter),
    [ledger.displayTransactions, activeBucketFilter])
  const isServerMode = props.showAllCycles
  const serverTotal = ledger.serverResult?.total ?? 0
  const activeStartDate = props.showAllCycles ? ledger.appliedStartDate : ledger.selectedStartDate
  const activeEndDate = props.showAllCycles ? ledger.appliedEndDate : ledger.selectedEndDate
  const activeMinAmount = props.showAllCycles ? ledger.appliedMinAmount : ledger.selectedMinAmount
  const activeMaxAmount = props.showAllCycles ? ledger.appliedMaxAmount : ledger.selectedMaxAmount
  const activeRecurringFilter = props.showAllCycles ? ledger.appliedRecurringFilter : ledger.selectedRecurringFilter
  const activeWishlistFilter = props.showAllCycles ? ledger.appliedWishlistFilter : ledger.selectedWishlistFilter
  const activeReloadFilter = props.showAllCycles ? ledger.appliedReloadFilter : ledger.selectedReloadFilter
  const activeAccountIds = props.showAllCycles ? ledger.appliedAccountIds : ledger.selectedAccountIds
  const activeSearch = (props.showAllCycles ? ledger.appliedSearch : ledger.searchTerm).trim()
  const activeTxType = props.showAllCycles ? ledger.appliedTxTypeFilter : ledger.selectedTxTypeFilter
  const activeFilters = props.showAllCycles ? ledger.appliedFilters : ledger.selectedFilters
  const activeAdvancedFilterCount =
    (activeStartDate || activeEndDate ? 1 : 0) +
    (activeMinAmount || activeMaxAmount ? 1 : 0) +
    (activeRecurringFilter !== 'all' ? 1 : 0) +
    (activeWishlistFilter !== 'all' ? 1 : 0) +
    (activeReloadFilter !== 'all' ? 1 : 0) +
    (activeAccountIds.length > 0 ? 1 : 0) +
    (activeTxType && activeTxType.length > 0 ? 1 : 0)
  const hasAnyFilter = activeFilters.length > 0 || Boolean(activeSearch) || activeAdvancedFilterCount > 0
  const balanceSummary = React.useMemo(() => {
    if (props.showAllCycles || !activeBucketFilter || activeBucketFilter === 'Income') return null
    if (activeFilters.length !== 1 || activeSearch || activeAdvancedFilterCount > 0) return null
    return props.ledgerSummaries?.find(summary => summary.name === activeBucketFilter) ?? null
  }, [props.showAllCycles, props.ledgerSummaries, activeBucketFilter, activeFilters.length, activeSearch, activeAdvancedFilterCount])

  const listProps: LedgerListProps = {
    transactions: ledger.displayTransactions,
    accounts: props.accounts,
    listKey: `${props.selectedMonth}-${props.selectedYear}-${props.showAllCycles}-${ledger.currentPage}`,
    hideSensitive,
    maskFinancialFigures,
    currency,
    serverIsFetching: ledger.serverIsFetching,
    serverIsLoadingRows: isServerMode && ledger.serverIsReplacingRows,
    loadingRowCount: Math.min(ledger.pageSize, isMobile ? 5 : 8),
    pageTotals,
    isTxDeleting: ledger.isTxDeleting,
    isTxSyncing: ledger.isTxSyncing,
    onStartEdit: ledger.onStartEditStable,
    onDeleteClick: ledger.onDeleteClickStable,
    onEditBlocked: ledger.onEditBlockedStable,
    onMove: transaction => setMoveTransactions([transaction]),
    hasAnyFilter,
    onResetFilters: ledger.handleResetFilters,
    onAddTransaction: ledger.onAddTransactionStable,
    formatSensitive,
  }

  if (props.isSwitchingCycle) {
    return <CycleSkeleton variant="ledger" />
  }

  return (
    <div className="space-y-6">
      <LedgerToolbar
        selectedYear={props.selectedYear}
        hideSensitive={hideSensitive}
        isFormOpen={isFormOpen}
        onToggleForm={() => {
          if (isFormOpen) {
            formRef.current?.handleCloseForm()
          } else {
            formRef.current?.openFresh()
          }
        }}
        onOpenExport={() => ledger.setShowExportModal(true)}
        showAllCycles={props.showAllCycles}
        onShowAllCyclesChange={props.onShowAllCyclesChange}
        cyclesRange={props.cyclesRange}
      />

      <LedgerPendingReviews
        receiptReady={!hideSensitive && Boolean(props.receiptScanDraft) && !isFormOpen}
        receiptSplitReady={!hideSensitive && Boolean(props.receiptSplitDraft)}
        onReviewReceipt={props.onReviewReceiptScan}
        onReviewReceiptSplit={props.onReviewReceiptSplit}
      />

      <LedgerActiveFilterSummary
        showAllCycles={props.showAllCycles}
        cyclesRange={props.cyclesRange}
        isCurrentCycle={props.isCurrentCycle}
        selectedMonth={props.selectedMonth}
        selectedYear={props.selectedYear}
        cycleDay={props.cycleDay}
        hasAnyFilter={hasAnyFilter}
        activeCategoryFilters={props.showAllCycles ? ledger.appliedFilters : ledger.selectedFilters}
        activeTxType={props.showAllCycles ? ledger.appliedTxTypeFilter : ledger.selectedTxTypeFilter}
        activeReloadFilter={activeReloadFilter}
        activeAccountIds={activeAccountIds}
        accounts={props.accounts ?? []}
        activeSearch={props.showAllCycles ? ledger.appliedSearch : ledger.searchTerm}
        activeSearchMode={props.showAllCycles ? ledger.appliedSearchMode : ledger.searchMode}
        activeStartDate={activeStartDate}
        activeEndDate={activeEndDate}
        activeMinAmount={activeMinAmount}
        activeMaxAmount={activeMaxAmount}
        activeRecurringFilter={activeRecurringFilter}
        activeWishlistFilter={activeWishlistFilter}
        onResetFilters={ledger.handleResetFilters}
      />

      {balanceSummary && (
        <LedgerBalanceReconciliation
          category={balanceSummary}
          cycleLabel={getCycleLabelForDropdown(props.selectedMonth, props.selectedYear, props.cycleDay)}
          formatSensitive={formatSensitive}
        />
      )}

      <TransactionFormSheet
        ref={formRef}
        categories={props.categories}
        accounts={props.accounts}
        currency={currency}
        hideSensitive={hideSensitive}
        sensitivePreferenceStatus={app.sensitivePreferenceStatus}
        autocompleteSuggestions={props.autocompleteSuggestions || []}
        transactions={props.transactions}
        essentialsAlloc={props.essentialsAlloc ?? 0.5}
        growthAlloc={props.growthAlloc ?? 0.25}
        stabilityAlloc={props.stabilityAlloc ?? 0.15}
        rewardsAlloc={props.rewardsAlloc ?? 0.1}
        cycleDay={props.cycleDay}
        selectedMonth={props.showAllCycles ? undefined : props.selectedMonth}
        selectedYear={props.showAllCycles ? undefined : props.selectedYear}
        stabilityBalance={props.stabilityBalance ?? 0}
        stabilityTarget={props.stabilityTarget ?? 10000}
        stabilityOverflowRedirect={props.stabilityOverflowRedirect || ''}
        stabilityTopUpContext={props.stabilityTopUpContext}
        savingsGoals={props.savingsGoals}
        activeRecurringPayments={props.activeRecurringPayments}
        ledgerSummaries={props.ledgerSummaries}
        onAddTransaction={props.onAddTransaction}
        onUpdateTransaction={props.onUpdateTransaction}
        onStartEditPending={props.onStartEditPending}
        onAddFormOpenChange={handleAddFormOpenChange}
        onOutsideCycleSave={props.onOutsideCycleSave}
        autoOpenAddForm={props.autoOpenAddForm}
        autoOpenTxType={props.autoOpenTxType}
        autoOpenPrefill={props.autoOpenPrefill}
        onResetAutoOpen={props.onResetAutoOpen}
        receiptScanDraft={props.receiptScanDraft}
        onReceiptScanStarted={props.onReceiptScanStarted}
        onReceiptScanCleared={props.onReceiptScanCleared}
        activeScanJobIds={props.activeScanJobIds}
        failedScanJob={props.failedScanJob}
        aiEditDraft={props.aiEditDraft}
        onAiEditDraftConsumed={props.onAiEditDraftConsumed}
        onFetchTransactionById={props.onFetchTransactionById}
        onShowAlert={props.onShowAlert}
        receiptSplitDraft={props.receiptSplitDraft}
        failedReceiptSplitJob={props.failedReceiptSplitJob}
        onReceiptSplitStarted={props.onReceiptSplitStarted}
        onReceiptSplitCleared={props.onReceiptSplitCleared}
        autoOpenReceiptSplit={props.autoOpenReceiptSplit}
        onResetAutoOpenReceiptSplit={props.onResetAutoOpenReceiptSplit}
        onReceiptSplitOpenChange={props.onReceiptSplitOpenChange}
      />

      <LedgerFilterBar
        showAllCycles={props.showAllCycles}
        isMobile={isMobile}
        serverIsFetching={ledger.serverIsFetching}
        categories={props.categories}
        pendingSearchTerm={ledger.pendingSearchTerm}
        onPendingSearchChange={ledger.setPendingSearchTerm}
        onServerSearch={ledger.handleServerSearch}
        onClearServerSearch={ledger.handleClearServerSearch}
        searchTerm={ledger.searchTerm}
        onSearchTermChange={ledger.setSearchTerm}
        searchMode={props.showAllCycles ? ledger.pendingSearchMode : ledger.searchMode}
        onSearchModeChange={props.showAllCycles ? ledger.handlePendingSearchModeChange : ledger.setSearchMode}
        isFilterDropdownOpen={ledger.isFilterDropdownOpen}
        onFilterDropdownOpenChange={ledger.setIsFilterDropdownOpen}
        appliedFilters={ledger.appliedFilters}
        pendingFilters={ledger.pendingFilters}
        selectedFilters={ledger.selectedFilters}
        onToggleFilter={ledger.handleToggleFilter}
        startDate={props.showAllCycles ? ledger.pendingStartDate : ledger.selectedStartDate}
        onStartDateChange={props.showAllCycles ? ledger.setPendingStartDate : ledger.setSelectedStartDate}
        endDate={props.showAllCycles ? ledger.pendingEndDate : ledger.selectedEndDate}
        onEndDateChange={props.showAllCycles ? ledger.setPendingEndDate : ledger.setSelectedEndDate}
        minAmount={props.showAllCycles ? ledger.pendingMinAmount : ledger.selectedMinAmount}
        onMinAmountChange={props.showAllCycles ? ledger.setPendingMinAmount : ledger.setSelectedMinAmount}
        maxAmount={props.showAllCycles ? ledger.pendingMaxAmount : ledger.selectedMaxAmount}
        onMaxAmountChange={props.showAllCycles ? ledger.setPendingMaxAmount : ledger.setSelectedMaxAmount}
        recurringFilter={props.showAllCycles ? ledger.pendingRecurringFilter : ledger.selectedRecurringFilter}
        onRecurringFilterChange={props.showAllCycles ? ledger.setPendingRecurringFilter : ledger.setSelectedRecurringFilter}
        wishlistFilter={props.showAllCycles ? ledger.pendingWishlistFilter : ledger.selectedWishlistFilter}
        onWishlistFilterChange={props.showAllCycles ? ledger.setPendingWishlistFilter : ledger.setSelectedWishlistFilter}
        reloadFilter={props.showAllCycles ? ledger.pendingReloadFilter : ledger.selectedReloadFilter}
        onReloadFilterChange={ledger.handleToggleReloadFilter}
        accounts={props.accounts ?? []}
        accountIds={props.showAllCycles ? ledger.pendingAccountIds : ledger.selectedAccountIds}
        onAccountToggle={ledger.handleToggleAccount}
        txType={props.showAllCycles ? ledger.pendingTxTypeFilter : ledger.selectedTxTypeFilter}
        onTxTypeChange={ledger.handleToggleTxType}
        activeAdvancedFilterCount={activeAdvancedFilterCount}
        onClearFilters={ledger.handleClearFilters}
        onApplyFilters={ledger.handleApplyFilters}
        sortOrder={ledger.sortOrder}
        onSortOrderChange={value => {
          ledger.setSortOrder(value)
          props.onPreferredSortOrderChange?.(value)
          ledger.setCurrentPage(1)
        }}
      />

      {props.showAllCycles && (
        <LedgerServerStatus
          currentPage={ledger.currentPage}
          error={ledger.serverError}
          isFetching={ledger.serverIsFetching}
          syncingTransactions={ledger.syncingTransactions}
          listProps={listProps}
          onRetry={ledger.retryServerFetch}
        />
      )}

      <LedgerBulkSelectionLayer
        listProps={listProps}
        allTransactions={props.transactions}
        resetKey={bulkResetKey}
        cycleDay={props.cycleDay}
      />

      <LedgerMoveSheet isOpen={moveTransactions.length > 0} transactions={moveTransactions} cycleDay={props.cycleDay} onClose={() => setMoveTransactions([])} />

      <LedgerPagination
        currentPage={ledger.currentPage}
        pageSize={ledger.pageSize}
        totalItems={isServerMode ? serverTotal : ledger.filteredTransactions.length}
        totalPages={isServerMode ? (Math.ceil(serverTotal / ledger.pageSize) || 1) : ledger.totalPages}
        serverIsFetching={isServerMode && ledger.serverIsFetching}
        onPageChange={ledger.setCurrentPage}
        onPageSizeChange={(size) => {
          ledger.setPageSize(size)
          if (!props.showAllCycles) props.onPreferredPageSizeChange?.(size)
          ledger.setCurrentPage(1)
        }}
      />

      {ledger.showExportModal && (
        <React.Suspense fallback={null}>
          <LedgerExportModal
            isOpen
            exportIsFetching={ledger.exportIsFetching}
            onClose={() => ledger.setShowExportModal(false)}
            onExportPage={ledger.handleExportPage}
            onExportAll={ledger.handleExportAll}
            fullExportDisabled={props.showAllCycles && ledger.hasMatchingPendingTransactions}
          />
        </React.Suspense>
      )}

      <DeleteTransactionModal
        isOpen={ledger.showDeleteModal}
        transaction={ledger.txToDelete}
        onCancel={ledger.handleCancelDelete}
        onConfirm={ledger.handleConfirmDelete}
        formatSensitive={formatSensitive}
        attachedDocumentCount={ledger.attachedDocumentCount}
        alsoDeleteDocuments={ledger.alsoDeleteDocuments}
        onAlsoDeleteDocumentsChange={ledger.setAlsoDeleteDocuments}
        isOnline={!app.isOffline && navigator.onLine}
        areAttachedDocumentsLoading={ledger.areAttachedDocumentsLoading}
      />

      <EditDisabledModal
        isOpen={ledger.showEditDisabledModal}
        transaction={ledger.editBlockedTransaction}
        onClose={() => ledger.setShowEditDisabledModal(false)}
      />

    </div>
  )
}
