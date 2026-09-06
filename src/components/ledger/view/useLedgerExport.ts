import { useState, useEffect } from 'react'
import type { LedgerAccount, Transaction } from '../../../types'
import type { PagedTransactionResult } from '../../../lib/api'
import { downloadCsvBlob, downloadCsvRows, toFilename } from '../../../lib/csvExport'
import { getCycleLabelForDropdown } from '../../../lib/cycleLabels'
import type { TransactionSort } from '../../../lib/transactionOrdering'
import {
  parseTxTypes,
  type TransactionLinkFilter,
  type TransactionSearchMode,
  type TransactionTypeFilterOption,
} from '../../../lib/transactionFilters'

const TX_TYPE_LABELS = (type: TransactionTypeFilterOption): string =>
  type === 'inflow' ? 'Inflows' : type === 'outflow' ? 'Outflows' : 'Transfers'
import {
  splitFilterSelections,
  parseAmountFilter,
  laterDate,
  earlierDate,
  type LedgerTxType,
} from './ledgerViewTypes'

export interface UseLedgerExportOptions {
  hideSensitive: boolean
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  accounts?: LedgerAccount[]
  appliedFilters: string[]
  appliedSearch: string
  appliedSearchMode: TransactionSearchMode
  appliedStartDate: string
  appliedEndDate: string
  appliedMinAmount: string
  appliedMaxAmount: string
  appliedRecurringFilter: TransactionLinkFilter
  appliedWishlistFilter: TransactionLinkFilter
  appliedReloadFilter?: import('./ledgerViewTypes').LedgerReloadFilter
  appliedAccountIds: string[]
  appliedTxTypeFilter: LedgerTxType
  sortOrder: TransactionSort
  allCyclesRange: { startDate: string; endDate: string } | null
  serverResult: PagedTransactionResult | null
  serverIsReplacingRows: boolean
  displayTransactions: Transaction[]
  paginatedTransactions: Transaction[]
  filteredTransactions: Transaction[]
  filteredPendingTransactions: Transaction[]
  onExportTransactions?: (params: any) => Promise<{ blob: Blob; filename: string }>
  onShowAlert?: (message: string, title?: string) => void
  onAiExportRequestConsumed?: () => void
  aiExportRequest?: any
  currentPage: number
}

export function useLedgerExport(options: UseLedgerExportOptions) {
  const {
    hideSensitive,
    showAllCycles,
    cyclesRange,
    selectedMonth,
    selectedYear,
    cycleDay,
    accounts,
    appliedFilters,
    appliedSearch,
    appliedSearchMode,
    appliedStartDate,
    appliedEndDate,
    appliedMinAmount,
    appliedMaxAmount,
    appliedRecurringFilter,
    appliedWishlistFilter,
    appliedAccountIds,
    appliedTxTypeFilter,
    sortOrder,
    allCyclesRange,
    serverResult,
    serverIsReplacingRows,
    displayTransactions,
    paginatedTransactions,
    filteredTransactions,
    filteredPendingTransactions,
    onExportTransactions,
    onShowAlert,
    onAiExportRequestConsumed,
    aiExportRequest,
    currentPage,
  } = options

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)

  // Synchronize AI export requests
  useEffect(() => {
    if (!aiExportRequest) return
    if (!hideSensitive) setShowExportModal(true)
    onAiExportRequestConsumed?.()
  }, [aiExportRequest?.nonce, hideSensitive, onAiExportRequestConsumed])

  const getCycleRangeLabel = () => {
    if (cyclesRange === '3month') return 'Last 3 Cycles'
    if (cyclesRange === '6month') return 'Last 6 Cycles'
    if (cyclesRange === 'yearly') return `Full Year ${selectedYear}`
    return ''
  }

  const buildFilterLabel = () => {
    const { buckets, categories: cats } = splitFilterSelections(appliedFilters)
    const categoryFilters = [...buckets, ...cats]
    const parts: string[] = []
    if (categoryFilters.length > 0) {
      const label = categoryFilters.join(' + ')
      parts.push(`${label} ${categoryFilters.length > 1 ? 'Categories' : 'Category'}`)
    }
    // Through the canonical parser, not a scalar comparison: this filter is a list of selected
    // types. An empty list is truthy, and never equals 'inflow' or 'outflow', so comparing it
    // directly stamped "Transfers" on the filename of every unfiltered export.
    const activeTxTypes = parseTxTypes(appliedTxTypeFilter)
    if (activeTxTypes.length > 0) {
      parts.push(activeTxTypes.map(TX_TYPE_LABELS).join(' + '))
    }
    if (appliedStartDate || appliedEndDate) {
      parts.push(`Dates ${appliedStartDate || 'Any'} to ${appliedEndDate || 'Any'}`)
    }
    if (appliedMinAmount || appliedMaxAmount) {
      parts.push(`Amounts ${appliedMinAmount || '0'} to ${appliedMaxAmount || 'Any'}`)
    }
    if (appliedRecurringFilter === 'only') parts.push('Recurring')
    else if (appliedRecurringFilter === 'exclude') parts.push('Without Recurring')
    if (appliedWishlistFilter === 'only') parts.push('Reward Purchases')
    else if (appliedWishlistFilter === 'exclude') parts.push('Without Reward Purchases')
    if (appliedAccountIds.length > 0) parts.push(`${appliedAccountIds.length} Account${appliedAccountIds.length === 1 ? '' : 's'}`)
    if (appliedSearch) {
      parts.push(`Search ${appliedSearch}`)
    }
    return parts.join(' ')
  }

  const getExportAllFilename = () => {
    if (!showAllCycles) {
      const cycleLabel = getCycleLabelForDropdown(selectedMonth, selectedYear, cycleDay)
      return `${toFilename(cycleLabel)}.csv`
    }

    const rangeLabel = getCycleRangeLabel()
    const filterLabel = buildFilterLabel()
    const title = rangeLabel
      ? (filterLabel ? `${rangeLabel} ${filterLabel} Records` : `${rangeLabel} Records`)
      : (filterLabel ? `All ${filterLabel} Records` : 'All Records')
    return `${toFilename(title)}.csv`
  }

  const getPageExportFilename = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return `Ledger_Page_${currentPage}.csv`
    }
    const dates = rows.map(r => r.date)
    let minDate = dates[0]
    let maxDate = dates[0]
    for (const d of dates) {
      if (d < minDate) minDate = d
      if (d > maxDate) maxDate = d
    }
    const label = minDate === maxDate ? minDate : `${minDate}_to_${maxDate}`
    return `${toFilename(label)}.csv`
  }

  const handleExportPage = () => {
    if (hideSensitive) return
    if (showAllCycles && (!serverResult || serverIsReplacingRows)) {
      onShowAlert?.('Load the saved transactions before exporting this page.', 'Export Not Ready')
      return
    }
    const rows = showAllCycles && serverResult ? displayTransactions : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows), accounts)
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (showAllCycles && filteredPendingTransactions.length > 0) {
      onShowAlert?.('Wait for the matching transactions to finish syncing before exporting the entire result.', 'Export Not Ready')
      return
    }
    if (showAllCycles && onExportTransactions) {
      setExportIsFetching(true)
      try {
        const { buckets, categories: cats } = splitFilterSelections(appliedFilters)
        const result = await onExportTransactions({
          search: appliedSearch || undefined,
          searchMode: appliedSearchMode,
          ledgerCategories: buckets.length > 0 ? buckets : undefined,
          categories: cats.length > 0 ? cats : undefined,
          txType: appliedTxTypeFilter || null,
          reloadFilter: options.appliedReloadFilter && options.appliedReloadFilter !== 'all' ? options.appliedReloadFilter : undefined,
          accountIds: appliedAccountIds,
          startDate: laterDate(allCyclesRange?.startDate, appliedStartDate),
          endDate: earlierDate(allCyclesRange?.endDate, appliedEndDate),
          minAmount: parseAmountFilter(appliedMinAmount),
          maxAmount: parseAmountFilter(appliedMaxAmount),
          recurringFilter: appliedRecurringFilter,
          wishlistFilter: appliedWishlistFilter,
          sort: sortOrder,
        })
        downloadCsvBlob(result.blob, getExportAllFilename())
        setShowExportModal(false)
      } catch (err) {
        console.error(err)
        onShowAlert?.('Failed to export transactions.', 'Export Error')
      } finally {
        setExportIsFetching(false)
      }
      return
    }
    downloadCsvRows(filteredTransactions, getExportAllFilename(), accounts)
    setShowExportModal(false)
  }

  return {
    showExportModal,
    setShowExportModal,
    exportIsFetching,
    handleExportPage,
    handleExportAll,
  }
}
