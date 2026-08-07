import { Button } from './ui/Button'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type {
  Transaction,
  TransactionCategory,
  AutocompleteSuggestion,
  TransactionDocumentChanges,
  StabilityRecovery,
} from '../types'
import type { PagedTransactionResult, ReceiptScanResult } from '../lib/api'
import { CycleSkeleton } from './ui/Skeleton'
import { useAppContext } from '../contexts/AppContext'
import { LedgerExportModal } from './ledger/LedgerExportModal'
import { DeleteTransactionModal, EditDisabledModal } from './ledger/LedgerDeleteModals'
import { LedgerPagination } from './ledger/LedgerPagination'
import { LedgerFilterBar } from './ledger/LedgerFilterBar'
import { LedgerTransactionList } from './ledger/LedgerTransactionList'
import { TransactionFormSheet, type TransactionFormSheetRef } from './ledger/TransactionFormSheet'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../lib/useReceiptSplitPolling'
import { calculateLedgerTotals } from '../lib/ledgerTotals'
import { useIsMobile } from '../lib/useIsMobile'
import { formatCurrencyVal } from '../lib/utils'
import { X } from 'lucide-react'
import { SensitiveMask } from './ui/SensitiveAmount'

// Hooks and sub-components
import { useLedgerView } from './ledger/view/useLedgerView'
import { LedgerToolbar } from './ledger/view/LedgerToolbar'

const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']
const ReceiptSplitSheet = React.lazy(() =>
  import('./ledger/ReceiptSplitSheet').then(module => ({ default: module.ReceiptSplitSheet })))

interface LedgerViewProps {
  transactions: Transaction[]
  autocompleteSuggestions?: AutocompleteSuggestion[]
  onAddTransaction: (
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<string | void> | string | void
  onDeleteTransaction: (id: string, transaction?: Transaction) => Promise<void> | void
  onUpdateTransaction?: (
    id: string,
    transaction: Omit<Transaction, 'id'>,
    documentChanges?: TransactionDocumentChanges,
  ) => Promise<void> | void
  hideSensitive?: boolean
  categories: TransactionCategory[]
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  incomingCategory: string | null
  incomingFilters?: string[]
  incomingSearch?: string | null
  incomingDate?: string | null
  incomingStartDate?: string | null
  incomingEndDate?: string | null
  incomingMinAmount?: string | null
  incomingMaxAmount?: string | null
  incomingRecurringOnly?: boolean
  incomingWishlistOnly?: boolean
  incomingTxType?: 'inflow' | 'outflow' | 'transfer' | null
  highlightedTxId?: string | null
  onClearIncomingFilters?: () => void
  onClearHighlightedTx?: () => void
  showAllCycles: boolean
  onClearAllCycles: () => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  stabilityBalance?: number
  stabilityTarget?: number
  essentialsAlloc?: number
  growthAlloc?: number
  stabilityAlloc?: number
  rewardsAlloc?: number
  stabilityOverflowRedirect?: string
  /** Absent when the selected cycle is not the current one — a backdated salary gets no offer. */
  stabilityRecovery?: StabilityRecovery
  essentialsBalance?: number
  growthBalance?: number
  rewardsBalance?: number
  onFetchPagedTransactions?: (params: any) => Promise<PagedTransactionResult>
  onFetchTransactionById?: (id: string) => Promise<Transaction>
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  activeSyncId?: string | null
  activeSyncIds?: string[]
  deletingTxId?: string | null
  onStartEditPending?: (id: string | null) => void
  isSwitchingCycle?: boolean
  receiptScanDraft?: { jobId: string; result: ReceiptScanResult } | null
  onReceiptScanStarted?: (scanId: string) => void
  onReceiptScanCleared?: (scanId: string) => void | Promise<void>
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
  failedReceiptSplitJob?: ReceiptSplitFailure | null
  onReceiptSplitStarted?: (scanId: string) => void
  onReceiptSplitCleared?: (scanId: string) => void | Promise<void>
  onReceiptSplitOpenChange?: (open: boolean) => void
}

export const LedgerView: React.FC<LedgerViewProps> = (props) => {
  const app = useAppContext()
  const hideSensitive = props.hideSensitive ?? app.hideSensitive
  const currency = props.currency ?? app.currency
  const activeSyncId = props.activeSyncId ?? app.activeSyncId
  const activeSyncIds = props.activeSyncIds
    ?? (props.activeSyncId !== undefined
      ? (props.activeSyncId ? [props.activeSyncId] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingTxId = props.deletingTxId ?? app.deletingId
  const isMobile = useIsMobile(1024)

  const formRef = useRef<TransactionFormSheetRef>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isReceiptSplitOpen, setIsReceiptSplitOpen] = useState(false)
  const handleAddFormOpenChange = useCallback((open: boolean) => {
    setIsFormOpen(open)
    props.onAddFormOpenChange?.(open)
  }, [props.onAddFormOpenChange])
  const setReceiptSplitOpen = useCallback((open: boolean) => {
    setIsReceiptSplitOpen(open)
    props.onReceiptSplitOpenChange?.(open)
  }, [props.onReceiptSplitOpenChange])

  // The split editor is opened by a finished scan, not by a menu entry: the scan
  // itself is started from the transaction form's picker, and the form stays open
  // underneath so "Use This Amount" lands straight back in it.
  useEffect(() => {
    if (!props.receiptSplitDraft) return
    setReceiptSplitOpen(true)
  }, [props.receiptSplitDraft, setReceiptSplitOpen])

  // Same open, requested by the poller when a scan finished while the app was
  // elsewhere (the toast's follow-up).
  useEffect(() => {
    if (!props.autoOpenReceiptSplit) return
    setReceiptSplitOpen(true)
    props.onResetAutoOpenReceiptSplit?.()
  }, [props.autoOpenReceiptSplit, setReceiptSplitOpen, props.onResetAutoOpenReceiptSplit])

  const ledger = useLedgerView({
    ...props,
    isMobile,
    hideSensitive,
    activeSyncId,
    activeSyncIds,
    deletingTxId,
    formRef,
  })

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return hideSensitive
      ? <SensitiveMask />
      : <span className="transition-[filter] duration-200">{formatCurrency(val)}</span>
  }

  const pageTotals = React.useMemo(() => calculateLedgerTotals(ledger.displayTransactions), [ledger.displayTransactions])
  const isServerMode = props.showAllCycles && !!ledger.serverResult
  const activeStartDate = props.showAllCycles ? ledger.appliedStartDate : ledger.selectedStartDate
  const activeEndDate = props.showAllCycles ? ledger.appliedEndDate : ledger.selectedEndDate
  const activeMinAmount = props.showAllCycles ? ledger.appliedMinAmount : ledger.selectedMinAmount
  const activeMaxAmount = props.showAllCycles ? ledger.appliedMaxAmount : ledger.selectedMaxAmount
  const activeRecurringOnly = props.showAllCycles ? ledger.appliedRecurringOnly : ledger.selectedRecurringOnly
  const activeWishlistOnly = props.showAllCycles ? ledger.appliedWishlistOnly : ledger.selectedWishlistOnly
  const activeAdvancedFilterCount =
    (activeStartDate || activeEndDate ? 1 : 0) +
    (activeMinAmount || activeMaxAmount ? 1 : 0) +
    (activeRecurringOnly ? 1 : 0) +
    (activeWishlistOnly ? 1 : 0) +
    ((props.showAllCycles ? ledger.appliedTxTypeFilter : ledger.selectedTxTypeFilter) ? 1 : 0)

  if (props.isSwitchingCycle) {
    return <CycleSkeleton variant="ledger" />
  }

  return (
    <div className="space-y-6">
      <LedgerToolbar
        selectedMonth={props.selectedMonth}
        selectedYear={props.selectedYear}
        availableYears={props.availableYears}
        cycleDay={props.cycleDay}
        onSelectPeriod={props.onSelectPeriod}
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
      />

      {(() => {
        const activeCategoryFilters = props.showAllCycles ? ledger.appliedFilters : ledger.selectedFilters
        const activeTxType = props.showAllCycles ? ledger.appliedTxTypeFilter : ledger.selectedTxTypeFilter
        const activeSearch = props.showAllCycles ? ledger.appliedSearch : ledger.searchTerm
        const hasAnyFilter = activeCategoryFilters.length > 0 || !!activeTxType || !!activeSearch || activeAdvancedFilterCount > 0
        if (!props.showAllCycles && !hasAnyFilter) return null

        const parts: string[] = []
        if (props.showAllCycles) {
          if (props.cyclesRange === '3month') parts.push("last 3 cycles")
          else if (props.cyclesRange === '6month') parts.push("last 6 cycles")
          else if (props.cyclesRange === 'yearly') parts.push(`full year ${props.selectedYear}`)
          else parts.push("all cycles")
        } else {
          parts.push("current cycle")
        }

        const filterDetails: string[] = []
        const selectedBuckets = activeCategoryFilters.filter(f => LEDGER_BUCKETS.includes(f))
        const selectedCats = activeCategoryFilters.filter(f => !LEDGER_BUCKETS.includes(f))

        if (selectedBuckets.length > 0) {
          const names = selectedBuckets.map(b => `"${b}"`).join(' and ')
          filterDetails.push(`ledger category ${names}`)
        }
        if (selectedCats.length > 0) {
          const names = selectedCats.map(c => `"${c}"`).join(' and ')
          filterDetails.push(`category ${names}`)
        }
        if (activeStartDate || activeEndDate) {
          if (activeStartDate && activeEndDate && activeStartDate === activeEndDate) {
            filterDetails.push(`date ${activeStartDate}`)
          } else {
            filterDetails.push(`dates ${activeStartDate || 'any'} to ${activeEndDate || 'any'}`)
          }
        }
        if (activeMinAmount || activeMaxAmount) {
          filterDetails.push(`absolute amount ${activeMinAmount || '0'} to ${activeMaxAmount || 'any'}`)
        }
        if (activeTxType) {
          filterDetails.push(activeTxType === 'inflow' ? "inflows only" : activeTxType === 'outflow' ? "outflows only" : "transfers only")
        }
        if (activeRecurringOnly) filterDetails.push('recurring transactions only')
        if (activeWishlistOnly) filterDetails.push('wishlist purchases only')
        if (activeSearch) {
          filterDetails.push(`search "${activeSearch}"`)
        }

        const label = filterDetails.length > 0
          ? `Showing ${parts.join(', ')} — filtered by ${filterDetails.join(' & ')}`
          : `Showing ${parts.join(', ')}`

        return (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs animate-in fade-in duration-200">
            <div className="flex min-w-0 items-center gap-2 text-blue-500 font-medium leading-relaxed">
              <span className="size-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
              {label}
            </div>
            <Button variant="unstyled"
              onClick={ledger.handleResetFilters}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-blue-500/70 hover:text-blue-500 text-[10px] font-semibold transition cursor-pointer cursor-pointer"
            >
              <X className="size-3" /> Clear filter
            </Button>
          </div>
        )
      })()}

      <TransactionFormSheet
        ref={formRef}
        categories={props.categories}
        currency={currency}
        hideSensitive={hideSensitive}
        autocompleteSuggestions={props.autocompleteSuggestions || []}
        transactions={props.transactions}
        essentialsAlloc={props.essentialsAlloc ?? 0.5}
        growthAlloc={props.growthAlloc ?? 0.25}
        stabilityAlloc={props.stabilityAlloc ?? 0.15}
        rewardsAlloc={props.rewardsAlloc ?? 0.1}
        stabilityBalance={props.stabilityBalance ?? 0}
        stabilityTarget={props.stabilityTarget ?? 10000}
        stabilityOverflowRedirect={props.stabilityOverflowRedirect || ''}
        stabilityRecovery={props.stabilityRecovery}
        essentialsBalance={props.essentialsBalance ?? 0}
        growthBalance={props.growthBalance ?? 0}
        rewardsBalance={props.rewardsBalance ?? 0}
        onAddTransaction={props.onAddTransaction}
        onUpdateTransaction={props.onUpdateTransaction}
        onStartEditPending={props.onStartEditPending}
        onAddFormOpenChange={handleAddFormOpenChange}
        autoOpenAddForm={props.autoOpenAddForm}
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
      />

      {isReceiptSplitOpen && props.receiptSplitDraft && (
        <React.Suspense fallback={null}>
          <ReceiptSplitSheet
            isOpen
            currency={currency}
            draft={props.receiptSplitDraft}
            onClear={scanId => props.onReceiptSplitCleared?.(scanId)}
            onClose={() => setReceiptSplitOpen(false)}
            onUseResult={draft => formRef.current?.openWithDraft(draft)}
          />
        </React.Suspense>
      )}

      <LedgerFilterBar
        showAllCycles={props.showAllCycles}
        isMobile={isMobile}
        serverIsFetching={ledger.serverIsFetching}
        categories={props.categories}
        pendingSearchTerm={ledger.pendingSearchTerm}
        onPendingSearchChange={ledger.setPendingSearchTerm}
        onServerSearch={ledger.handleServerSearch}
        searchTerm={ledger.searchTerm}
        onSearchTermChange={ledger.setSearchTerm}
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
        recurringOnly={props.showAllCycles ? ledger.pendingRecurringOnly : ledger.selectedRecurringOnly}
        onRecurringOnlyChange={props.showAllCycles ? ledger.setPendingRecurringOnly : ledger.setSelectedRecurringOnly}
        wishlistOnly={props.showAllCycles ? ledger.pendingWishlistOnly : ledger.selectedWishlistOnly}
        onWishlistOnlyChange={props.showAllCycles ? ledger.setPendingWishlistOnly : ledger.setSelectedWishlistOnly}
        txType={props.showAllCycles ? ledger.pendingTxTypeFilter : ledger.selectedTxTypeFilter}
        onTxTypeChange={props.showAllCycles ? ledger.setPendingTxTypeFilter : ledger.setSelectedTxTypeFilter}
        activeAdvancedFilterCount={activeAdvancedFilterCount}
        onClearFilters={ledger.handleClearFilters}
        onApplyFilters={ledger.handleApplyFilters}
        sortOrder={ledger.sortOrder}
        onSortOrderChange={value => {
          ledger.setSortOrder(value)
          ledger.setCurrentPage(1)
        }}
      />

      <LedgerTransactionList
        transactions={ledger.displayTransactions}
        listKey={`${props.selectedMonth}-${props.selectedYear}-${props.showAllCycles}-${ledger.currentPage}`}
        hideSensitive={hideSensitive}
        currency={currency}
        serverIsFetching={ledger.serverIsFetching}
        pageTotals={pageTotals}
        isTxDeleting={ledger.isTxDeleting}
        isTxSyncing={ledger.isTxSyncing}
        onStartEdit={ledger.onStartEditStable}
        onDeleteClick={ledger.onDeleteClickStable}
        onEditBlocked={ledger.onEditBlockedStable}
        formatSensitive={formatSensitive}
      />

      <LedgerPagination
        currentPage={ledger.currentPage}
        pageSize={ledger.pageSize}
        totalItems={isServerMode ? ledger.serverResult!.total : ledger.filteredTransactions.length}
        totalPages={isServerMode ? (Math.ceil(ledger.serverResult!.total / ledger.pageSize) || 1) : ledger.totalPages}
        serverIsFetching={isServerMode && ledger.serverIsFetching}
        onPageChange={ledger.setCurrentPage}
        onPageSizeChange={(size) => {
          ledger.setPageSize(size)
          ledger.setCurrentPage(1)
        }}
      />

      <LedgerExportModal
        isOpen={ledger.showExportModal}
        exportIsFetching={ledger.exportIsFetching}
        onClose={() => ledger.setShowExportModal(false)}
        onExportPage={ledger.handleExportPage}
        onExportAll={ledger.handleExportAll}
      />

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
        isConfirming={ledger.isDeletingAttachedDocuments}
      />

      <EditDisabledModal
        isOpen={ledger.showEditDisabledModal}
        transaction={ledger.editBlockedTransaction}
        onClose={() => ledger.setShowEditDisabledModal(false)}
      />
    </div>
  )
}
