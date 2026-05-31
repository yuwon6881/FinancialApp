import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { Transaction, TransactionCategory } from '../types'
import type { PagedTransactionResult } from '../lib/api'
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  X,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { formatCurrencyVal, getCurrencySymbol } from '../lib/utils'

interface LedgerViewProps {
  transactions: Transaction[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void
  onDeleteTransaction: (id: string) => void
  onUpdateTransaction?: (id: string, transaction: Omit<Transaction, 'id'>) => void
  hideSensitive: boolean
  categories: TransactionCategory[]
  selectedMonth: string
  selectedYear: number
  availableYears: number[]
  cycleDay: number
  onSelectPeriod: (month: string, year: number) => void
  incomingCategory: string | null
  incomingDate?: string | null
  incomingTxType?: 'inflow' | 'outflow' | null
  highlightedTxId?: string | null
  onClearIncomingFilters?: () => void
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
  onFetchPagedTransactions?: (params: {
    page: number
    pageSize: number
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | null
    startDate?: string
    endDate?: string
  }) => Promise<PagedTransactionResult>
  onExportTransactions?: (params: {
    search?: string
    ledgerCategories?: string[]
    categories?: string[]
    txType?: 'inflow' | 'outflow' | null
    startDate?: string
    endDate?: string
  }) => Promise<{ blob: Blob; filename: string }>
}

function formatDateToString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getCycleRangeDates(year: number, monthIndex: number, cycleDay: number): { start: Date; end: Date } {
  if (cycleDay === 1) {
    const start = new Date(year, monthIndex - 1, 1)
    const end = new Date(year, monthIndex, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  const daysInStartMonth = new Date(year, monthIndex, 0).getDate()
  const startDayActual = Math.min(cycleDay, daysInStartMonth)
  const start = new Date(year, monthIndex - 1, startDayActual)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() - 1)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function getStartOfNCyclesAgo(activeYear: number, activeMonthIndex: number, cycleDay: number, n: number): Date {
  let curMonth = activeMonthIndex
  let curYear = activeYear

  for (let i = 0; i < n - 1; i++) {
    curMonth--
    if (curMonth < 1) {
      curMonth = 12
      curYear--
    }
  }

  const { start } = getCycleRangeDates(curYear, curMonth, cycleDay)
  return start
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  onUpdateTransaction,
  hideSensitive,
  categories,
  selectedMonth,
  selectedYear,
  availableYears,
  cycleDay,
  onSelectPeriod,
  incomingCategory,
  incomingDate,
  incomingTxType,
  highlightedTxId,
  onClearIncomingFilters,
  showAllCycles,
  onClearAllCycles,
  cyclesRange,
  currency = 'USD',
  autoOpenAddForm,
  onResetAutoOpen,
  stabilityBalance = 0,
  stabilityTarget = 10000,
  essentialsAlloc = 0.5,
  growthAlloc = 0.25,
  stabilityAlloc = 0.15,
  rewardsAlloc = 0.1,
  onFetchPagedTransactions,
  onExportTransactions
}) => {
  const [showAddForm, setShowAddForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [txType, setTxType] = useState<'inflow' | 'outflow' | 'transfer'>('outflow')
  const [category, setCategory] = useState('')
  const [ledgerCategory, setLedgerCategory] = useState<'Income' | 'Essentials' | 'Growth' | 'Stability' | 'Rewards'>('Essentials')
  const [transferSource, setTransferSource] = useState<'Essentials' | 'Growth' | 'Stability' | 'Rewards'>('Essentials')
  const [transferTarget, setTransferTarget] = useState<'Essentials' | 'Growth' | 'Stability' | 'Rewards'>('Rewards')
  const [date, setDate] = useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  const [editingTxId, setEditingTxId] = useState<string | null>(null)

  const formRef = React.useRef<HTMLDivElement>(null)
  const firstInputRef = React.useRef<HTMLInputElement>(null)

  const [showStabilityCapModal, setShowStabilityCapModal] = useState(false)
  const [pendingTxData, setPendingTxData] = useState<{
    description: string
    amount: number
    category: string
    date: string
    isEdit: boolean
    id?: string
  } | null>(null)
  const [selectedRedirectCategories, setSelectedRedirectCategories] = useState<('Essentials' | 'Growth' | 'Rewards')[]>(['Rewards'])
  const [isRedirectMode, setIsRedirectMode] = useState<boolean>(true)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)
  const [showEditDisabledModal, setShowEditDisabledModal] = useState(false)

  useEffect(() => {
    if (autoOpenAddForm) {
      setShowAddForm(true)
      onResetAutoOpen?.()
    }
  }, [autoOpenAddForm, onResetAutoOpen])

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        firstInputRef.current?.focus()
      }, 100)
    }
  }, [showAddForm, editingTxId])

  const handleStartEdit = (t: Transaction) => {
    setEditingTxId(t.id)
    setDescription(t.description)
    setAmount(Math.abs(t.amount).toString())
    setDate(t.date)
    if (t.ledgerCategory.startsWith('Transfer:')) {
      setTxType('transfer')
      const parts = t.ledgerCategory.substring(9).split('->')
      if (parts.length === 2) {
        setTransferSource(parts[0].trim() as any)
        setTransferTarget(parts[1].trim() as any)
      }
    } else {
      if (t.amount < 0) {
        setTxType('outflow')
      } else {
        setTxType('inflow')
      }
      setCategory(t.category)
      if (t.ledgerCategory.startsWith('IncomeSplit:')) {
        setLedgerCategory('Income')
      } else {
        setLedgerCategory(t.ledgerCategory as any)
      }
    }
    setShowAddForm(true)
  }

  // Reset Ledger Category and Category defaults on transaction type changes (adding mode only)
  useEffect(() => {
    if (editingTxId) return

    if (txType === 'inflow') {
      setLedgerCategory('Income')
      const hasSalary = categories.some(c => c.name === 'Salary')
      if (hasSalary) {
        setCategory('Salary')
      } else if (categories.length > 0) {
        setCategory(categories[0].name)
      }
    } else if (txType === 'outflow') {
      if (ledgerCategory === 'Income') {
        setLedgerCategory('Essentials')
      }
    }
  }, [txType, categories, editingTxId])

  // Auto-generate description for transfers
  useEffect(() => {
    if (txType === 'transfer') {
      setDescription(`Transfer from ${transferSource} to ${transferTarget}`)
    }
  }, [txType, transferSource, transferTarget])

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name)
    }
  }, [categories, category])

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilters, setSelectedFilters] = useState<string[]>([])
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null)
  const [selectedTxTypeFilter, setSelectedTxTypeFilter] = useState<'inflow' | 'outflow' | null>(null)
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

  // Pagination states (Defaults: page size 10, current page 1)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Server-side paged all-cycles state
  const [serverResult, setServerResult] = useState<PagedTransactionResult | null>(null)
  const [serverIsFetching, setServerIsFetching] = useState(false)
  const isInitialFetchDone = useRef(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportIsFetching, setExportIsFetching] = useState(false)
  // Pending (uncommitted) states — only applied on Search/Apply button click
  const [pendingSearchTerm, setPendingSearchTerm] = useState('')
  const [pendingFilters, setPendingFilters] = useState<string[]>([])
  // Applied (committed) states — what the backend has actually received
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<string[]>([])
  const [appliedTxTypeFilter, setAppliedTxTypeFilter] = useState<'inflow' | 'outflow' | null>(null)

  const ledgerBuckets = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']
  const allCyclesRange = useMemo(() => {
    if (!showAllCycles) return null
    if (!cyclesRange || cyclesRange === 'monthly') return null
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const activeMonthIdx = monthNames.indexOf(selectedMonth) + 1
    if (activeMonthIdx <= 0) return null
    const activeYear = selectedYear

    let startDate: Date | null = null
    let endDate: Date | null = null

    if (cyclesRange === '3month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 3)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === '6month') {
      startDate = getStartOfNCyclesAgo(activeYear, activeMonthIdx, cycleDay, 6)
      endDate = getCycleRangeDates(activeYear, activeMonthIdx, cycleDay).end
    } else if (cyclesRange === 'yearly') {
      startDate = getCycleRangeDates(activeYear, 1, cycleDay).start
      endDate = getCycleRangeDates(activeYear, 12, cycleDay).end
    }

    if (!startDate || !endDate) return null
    return {
      startDate: formatDateToString(startDate),
      endDate: formatDateToString(endDate)
    }
  }, [showAllCycles, cyclesRange, selectedMonth, selectedYear, cycleDay])

  const runServerFetch = useCallback(async (opts: {
    page: number
    search: string
    filters: string[]
    txType: 'inflow' | 'outflow' | null
    pSize: number
  }) => {
    if (!onFetchPagedTransactions) return
    setServerIsFetching(true)
    try {
      const buckets = opts.filters.filter(f => ledgerBuckets.includes(f))
      const cats = opts.filters.filter(f => !ledgerBuckets.includes(f))
      const result = await onFetchPagedTransactions({
        page: opts.page,
        pageSize: opts.pSize,
        search: opts.search || undefined,
        ledgerCategories: buckets.length > 0 ? buckets : undefined,
        categories: cats.length > 0 ? cats : undefined,
        txType: opts.txType || null,
        startDate: allCyclesRange?.startDate,
        endDate: allCyclesRange?.endDate
      })
      setServerResult(result)
    } finally {
      setServerIsFetching(false)
    }
  }, [onFetchPagedTransactions, allCyclesRange])

  // Trigger initial server fetch when entering all-cycles mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions) {
      setPendingSearchTerm('')
      setPendingFilters([])
      setAppliedSearch('')
      setAppliedFilters([])
      setAppliedTxTypeFilter(null)
      setCurrentPage(1)
      setPageSize(100)  // Default 100 for server mode — covers most users' full history on page 1
      isInitialFetchDone.current = false
      runServerFetch({ page: 1, search: '', filters: [], txType: null, pSize: 100 })
        .finally(() => {
          isInitialFetchDone.current = true
        })
    } else {
      setServerResult(null)
      isInitialFetchDone.current = false
    }
  }, [showAllCycles, onFetchPagedTransactions, runServerFetch, allCyclesRange])

  // Re-fetch when page changes in server mode
  useEffect(() => {
    if (showAllCycles && onFetchPagedTransactions && isInitialFetchDone.current) {
      runServerFetch({ page: currentPage, search: appliedSearch, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
    }
  }, [currentPage, pageSize, showAllCycles, onFetchPagedTransactions, runServerFetch, appliedSearch, appliedFilters, appliedTxTypeFilter, allCyclesRange])

  // Reset back to page 1 when search inputs or active filters are updated (client-side mode only)
  useEffect(() => {
    if (!showAllCycles) setCurrentPage(1)
  }, [searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter, showAllCycles])

  // Synchronize incoming filters from props
  useEffect(() => {
    if (incomingCategory) {
      setSelectedFilters([incomingCategory])
    } else {
      setSelectedFilters([])
    }
  }, [incomingCategory])

  useEffect(() => {
    setSelectedDateFilter(incomingDate || null)
  }, [incomingDate])

  useEffect(() => {
    setSelectedTxTypeFilter(incomingTxType || null)
  }, [incomingTxType])

  // Toggle filter on or off
  const handleToggleFilter = (filterName: string) => {
    if (showAllCycles) {
      // In server mode: toggle pending filters only
      setPendingFilters(prev =>
        prev.includes(filterName) ? prev.filter(f => f !== filterName) : [...prev, filterName]
      )
    } else {
      setSelectedFilters(prev =>
        prev.includes(filterName) ? prev.filter(f => f !== filterName) : [...prev, filterName]
      )
    }
  }

  const handleClearFilters = () => {
    if (showAllCycles) {
      setPendingFilters([])
      setAppliedFilters([])
      setCurrentPage(1)
      runServerFetch({ page: 1, search: appliedSearch, filters: [], txType: appliedTxTypeFilter, pSize: pageSize })
    } else {
      setSelectedFilters([])
    }
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setCurrentPage(1)
    setIsFilterDropdownOpen(false)
    runServerFetch({ page: 1, search: appliedSearch, filters: pendingFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  const handleServerSearch = () => {
    setAppliedSearch(pendingSearchTerm)
    setCurrentPage(1)
    runServerFetch({ page: 1, search: pendingSearchTerm, filters: appliedFilters, txType: appliedTxTypeFilter, pSize: pageSize })
  }

  // Toggle dropdown on click out
  useEffect(() => {
    if (!isFilterDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.ledger-filter-dropdown')) {
        setIsFilterDropdownOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isFilterDropdownOpen])

  const categoryColorMap: Record<string, string> = {
    'Salary': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Social': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'Food': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Hobbies': 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    'Software': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'Investment': 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    'Entertainment': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Transport': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Other': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  }

  const resetFormFields = () => {
    setDescription('')
    setAmount('')
    setLedgerCategory('Essentials')
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setDate(`${y}-${mo}-${d}`)
    setEditingTxId(null)
    setShowAddForm(false)
  }

  const handleToggleCategory = (cat: 'Essentials' | 'Growth' | 'Rewards') => {
    setSelectedRedirectCategories(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat)
      } else {
        return [...prev, cat]
      }
    })
  }

  const calcRedirectionSplits = (
    keepDefault: boolean,
    selectedTargets: ('Essentials' | 'Growth' | 'Rewards')[]
  ) => {
    let ess = essentialsAlloc
    let gro = growthAlloc
    let sta = stabilityAlloc
    let rew = rewardsAlloc

    if (keepDefault || !pendingTxData) {
      return { ess, gro, sta, rew }
    }

    const txAmount = pendingTxData.amount
    const defaultStabilityContribution = txAmount * stabilityAlloc

    // Check if cap is already reached or mid-deposit
    const isCapReached = stabilityBalance >= stabilityTarget
    
    let actualStabilityShare = 0
    if (!isCapReached) {
      const stabilityNeeded = Math.max(0, stabilityTarget - stabilityBalance)
      if (defaultStabilityContribution > stabilityNeeded) {
        // Capped mid-deposit
        actualStabilityShare = stabilityNeeded / txAmount
      } else {
        actualStabilityShare = stabilityAlloc
      }
    }

    const redirectShare = stabilityAlloc - actualStabilityShare
    sta = actualStabilityShare

    if (redirectShare > 0 && selectedTargets.length > 0) {
      const N = selectedTargets.length
      const baseSharePerTarget = Math.floor((redirectShare / N) * 10000) / 10000
      const sumOfShares = baseSharePerTarget * N
      const remainder = redirectShare - sumOfShares

      selectedTargets.forEach((target, index) => {
        let addedShare = baseSharePerTarget
        if (index === 0) {
          addedShare += remainder
        }

        if (target === 'Essentials') ess += addedShare
        if (target === 'Growth') gro += addedShare
        if (target === 'Rewards') rew += addedShare
      })
    }

    // Round everything to 4 decimal places
    ess = Math.round(ess * 10000) / 10000
    gro = Math.round(gro * 10000) / 10000
    sta = Math.round(sta * 10000) / 10000
    rew = Math.round(rew * 10000) / 10000

    return { ess, gro, sta, rew }
  }

  const handleConfirmStabilityCapSplit = () => {
    if (!pendingTxData) return

    let splitSpec = 'Income'
    if (isRedirectMode) {
      const { ess, gro, sta, rew } = calcRedirectionSplits(false, selectedRedirectCategories)
      splitSpec = `IncomeSplit:${(ess * 100).toFixed(4)},${(gro * 100).toFixed(4)},${(sta * 100).toFixed(4)},${(rew * 100).toFixed(4)}`
    }

    if (pendingTxData.isEdit && pendingTxData.id) {
      onUpdateTransaction?.(pendingTxData.id, {
        description: pendingTxData.description,
        amount: pendingTxData.amount,
        category: pendingTxData.category,
        ledgerCategory: splitSpec,
        date: pendingTxData.date
      })
    } else {
      onAddTransaction({
        description: pendingTxData.description,
        amount: pendingTxData.amount,
        category: pendingTxData.category,
        ledgerCategory: splitSpec,
        date: pendingTxData.date
      })
    }

    setShowStabilityCapModal(false)
    setPendingTxData(null)
    resetFormFields()
  }

  const handleCancelStabilityCapModal = () => {
    setShowStabilityCapModal(false)
    setPendingTxData(null)
  }

  const handleDeleteClick = (t: Transaction) => {
    setTxToDelete(t)
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    if (!txToDelete) return

    let deleteId = txToDelete.id
    if (txToDelete.id.includes('-split-')) {
      deleteId = txToDelete.id.split('-split-')[0]
    }

    onDeleteTransaction(deleteId)
    setShowDeleteModal(false)
    setTxToDelete(null)
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
    setTxToDelete(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !amount || !date) return

    const parsedAmount = parseFloat(amount)
    let finalAmount = parsedAmount
    let finalLedgerCategory = ledgerCategory

    if (txType === 'outflow') {
      finalAmount = -Math.abs(parsedAmount)
    } else if (txType === 'inflow') {
      finalAmount = Math.abs(parsedAmount)
    } else if (txType === 'transfer') {
      finalAmount = Math.abs(parsedAmount)
      finalLedgerCategory = `Transfer:${transferSource}->${transferTarget}` as any
    }

    const isIncome = txType === 'inflow' && ledgerCategory === 'Income'
    const isCapReached = stabilityBalance >= stabilityTarget
    const defaultStabilityContribution = finalAmount * stabilityAlloc
    const isCapReachedMidDeposit = !isCapReached && (stabilityBalance + defaultStabilityContribution > stabilityTarget)

    if (isIncome && (isCapReached || isCapReachedMidDeposit)) {
      setPendingTxData({
        description,
        amount: finalAmount,
        category: category,
        date,
        isEdit: !!editingTxId,
        id: editingTxId || undefined
      })
      setShowStabilityCapModal(true)
      return
    }

    if (editingTxId) {
      onUpdateTransaction?.(editingTxId, {
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Transfer' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
    } else {
      onAddTransaction({
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Transfer' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
    }

    resetFormFields()
  }

  const sourceTransactions = useMemo(() => transactions, [transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    // Group filters by their type (Ledger Buckets vs Subcategories)
    const ledgerBuckets = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']
    const selectedBuckets = selectedFilters.filter(f => ledgerBuckets.includes(f))
    const selectedSubcategories = selectedFilters.filter(f => !ledgerBuckets.includes(f))

    return sourceTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.ledgerCategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.category.toLowerCase().includes(searchTerm.toLowerCase())
      
      let matchesBucket = true
      if (selectedBuckets.length > 0) {
        matchesBucket = selectedBuckets.some(bucket => {
          if (bucket === 'Income') {
            return t.ledgerCategory === 'Income' || t.ledgerCategory.startsWith('IncomeSplit:')
          }
          return t.ledgerCategory === bucket || t.ledgerCategory.includes(bucket)
        })
      }

      let matchesSubcat = true
      if (selectedSubcategories.length > 0) {
        matchesSubcat = selectedSubcategories.some(subcat => t.category === subcat)
      }

      let matchesDate = true
      if (selectedDateFilter) {
        matchesDate = t.date === selectedDateFilter
      }

      let matchesTxType = true
      if (selectedTxTypeFilter) {
        if (selectedTxTypeFilter === 'inflow') {
          matchesTxType = t.amount > 0
        } else if (selectedTxTypeFilter === 'outflow') {
          matchesTxType = t.amount < 0
        }
      }
      
      return matchesSearch && matchesBucket && matchesSubcat && matchesDate && matchesTxType
    }).sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return b.id.localeCompare(a.id)
    })
  }, [sourceTransactions, searchTerm, selectedFilters, selectedDateFilter, selectedTxTypeFilter])

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredTransactions.slice(startIndex, startIndex + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  // In server mode use the items from server; in client mode use local pagination
  const displayTransactions = (showAllCycles && serverResult) ? serverResult.items : paginatedTransactions

  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1

  // Handle highlighted transaction scroll into view and page calculation
  useEffect(() => {
    if (highlightedTxId) {
      const index = filteredTransactions.findIndex(t => t.id === highlightedTxId)
      if (index !== -1) {
        const targetPage = Math.floor(index / pageSize) + 1
        setCurrentPage(targetPage)
        
        const timer = setTimeout(() => {
          const rowEl = document.getElementById(`tx-row-${highlightedTxId}`)
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            rowEl.classList.add('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
            const clearTimer = setTimeout(() => {
              rowEl.classList.remove('bg-blue-500/10', 'ring-2', 'ring-blue-500/30', 'dark:bg-blue-500/20')
              onClearIncomingFilters?.()
            }, 3000)
            return () => clearTimeout(clearTimer)
          }
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [highlightedTxId, filteredTransactions, pageSize, onClearIncomingFilters])

  const displayLedgerCategory = (cat: string) => {
    if (cat.startsWith('IncomeSplit:')) return 'Income'
    if (cat.startsWith('Transfer:Income->')) {
      return cat.substring(17)
    }
    if (cat.startsWith('Transfer:')) {
      return 'Transfer'
    }
    return cat
  }

  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, currency)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-[filter] duration-200' : 'transition-[filter] duration-200'}>
        {formatCurrency(val)}
      </span>
    )
  }

  const isServerMode = showAllCycles && !!serverResult

  // CSV export with proper quoting
  const escapeCsvField = (val: string | number) => {
    const str = String(val)
    // Wrap in quotes if it contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const toFilename = (value: string) => {
    return value
      .replace(/[<>:"/\\|?*]+/g, '')
      .replace(/~/g, '-')
      .replace(/[,\s]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/_+$/g, '')
  }

  const getCycleRangeLabel = () => {
    if (cyclesRange === '3month') return 'Last 3 Cycles'
    if (cyclesRange === '6month') return 'Last 6 Cycles'
    if (cyclesRange === 'yearly') return `Full Year ${selectedYear}`
    return ''
  }

  const buildFilterLabel = () => {
    const buckets = appliedFilters.filter(f => ledgerBuckets.includes(f))
    const cats = appliedFilters.filter(f => !ledgerBuckets.includes(f))
    const categoryFilters = [...buckets, ...cats]
    const parts: string[] = []
    if (categoryFilters.length > 0) {
      const label = categoryFilters.join(' + ')
      parts.push(`${label} ${categoryFilters.length > 1 ? 'Categories' : 'Category'}`)
    }
    if (appliedTxTypeFilter) {
      parts.push(appliedTxTypeFilter === 'inflow' ? 'Inflows' : 'Outflows')
    }
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

  const buildCsvContent = (rows: Transaction[]) => {
    const headers = ['Date', 'Description', 'Category', 'Ledger Category', 'Debit (Outflow)', 'Credit (Inflow)']
    const dataRows = rows.map(t => {
      const isOutflow = t.amount < 0
      const isTransfer = t.ledgerCategory.startsWith('Transfer:')
      return [
        escapeCsvField(t.date),
        escapeCsvField(t.description),
        escapeCsvField(t.category),
        displayLedgerCategory(t.ledgerCategory),
        isTransfer ? escapeCsvField(t.amount.toFixed(2)) : (isOutflow ? escapeCsvField(Math.abs(t.amount).toFixed(2)) : ''),
        isTransfer ? escapeCsvField(t.amount.toFixed(2)) : (!isOutflow ? escapeCsvField(t.amount.toFixed(2)) : '')
      ]
    })
    return [headers.join(','), ...dataRows.map(e => e.join(','))].join('\n')
  }

  const downloadCsvRows = (rows: Transaction[], filename: string) => {
    const csvContent = buildCsvContent(rows)
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(csvBlob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadCsvBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportPage = () => {
    if (hideSensitive) return
    const rows = isServerMode ? (serverResult?.items || []) : paginatedTransactions
    downloadCsvRows(rows, getPageExportFilename(rows))
    setShowExportModal(false)
  }

  const handleExportAll = async () => {
    if (hideSensitive) return
    if (isServerMode && onExportTransactions) {
      setExportIsFetching(true)
      try {
        const buckets = appliedFilters.filter(f => ledgerBuckets.includes(f))
        const cats = appliedFilters.filter(f => !ledgerBuckets.includes(f))
        const result = await onExportTransactions({
          search: appliedSearch || undefined,
          ledgerCategories: buckets.length > 0 ? buckets : undefined,
          categories: cats.length > 0 ? cats : undefined,
          txType: appliedTxTypeFilter || null,
          startDate: allCyclesRange?.startDate,
          endDate: allCyclesRange?.endDate
        })
        downloadCsvBlob(result.blob, getExportAllFilename())
        setShowExportModal(false)
      } catch (err) {
        console.error(err)
        alert('Failed to export transactions.')
      } finally {
        setExportIsFetching(false)
      }
      return
    }
    downloadCsvRows(filteredTransactions, getExportAllFilename())
    setShowExportModal(false)
  }

  const renderPageNumbers = (tp = totalPages) => {
    const pages: (number | string)[] = []
    if (tp <= 5) {
      for (let i = 1; i <= tp; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', tp)
      } else if (currentPage >= tp - 2) {
        pages.push(1, '...', tp - 2, tp - 1, tp)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', tp)
      }
    }
    return pages.map((p, idx) => (
      p === '...' ? (
        <span key={`dots-${idx}`} className="px-2 py-1.5 text-muted-foreground text-xs select-none">...</span>
      ) : (
        <button
          key={`page-${p}`}
          onClick={() => setCurrentPage(p as number)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition ${
            currentPage === p
              ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
              : 'border-border bg-background hover:bg-muted text-foreground'
          }`}
        >
          {p}
        </button>
      )
    ))
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Header section with total and actions */}
      <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">Double-Entry Financial Ledger</h2>
            
            {/* Cycle Selector */}
            <div className="flex items-center gap-1.5 select-none w-full sm:w-auto">
              <CustomSelect
                value={selectedMonth}
                onChange={(val) => onSelectPeriod(val, selectedYear)}
                options={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({
                  value: m,
                  label: getCycleLabelForDropdown(m, selectedYear, cycleDay)
                }))}
                className="flex-1 sm:w-56 sm:flex-initial"
              />
              <CustomSelect
                value={selectedYear}
                onChange={(val) => onSelectPeriod(selectedMonth, parseInt(val))}
                options={availableYears.map(y => ({
                  value: y,
                  label: y.toString()
                }))}
                className="w-28 shrink-0"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Comprehensive posting of all accounts and transactional balances for the currently selected cycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExportModal(true)}
            disabled={hideSensitive}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border font-medium text-xs transition duration-200 ${
              hideSensitive 
                ? 'opacity-40 cursor-not-allowed bg-background text-muted-foreground' 
                : 'bg-background hover:bg-muted text-foreground cursor-pointer'
            }`}
            title={hideSensitive ? 'CSV Export disabled in blur mode' : 'Export CSV'}
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>
          <button
            onClick={() => {
              if (showAddForm) {
                setDescription('')
                setAmount('')
                setLedgerCategory('Essentials')
                setEditingTxId(null)
              }
              setShowAddForm(prev => !prev)
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition duration-200 cursor-pointer"
          >
            {showAddForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showAddForm ? 'Cancel' : 'Post Transaction'}
          </button>
        </div>
      </div>

      {/* Dashboard navigation filter banner */}
      {(incomingCategory || incomingDate || incomingTxType || showAllCycles) && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-blue-500 font-medium">
            <span className="size-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
            {(() => {
              const parts: string[] = []
              if (showAllCycles) {
                if (cyclesRange === '3month') parts.push("last 3 cycles")
                else if (cyclesRange === '6month') parts.push("last 6 cycles")
                else if (cyclesRange === 'yearly') parts.push(`full year ${selectedYear}`)
                else parts.push("all cycles")
              } else {
                parts.push("current cycle")
              }

              const filterDetails: string[] = []
              if (incomingCategory) {
                const isLedgerBucket = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'].includes(incomingCategory)
                filterDetails.push(`${isLedgerBucket ? 'ledger category' : 'category'} "${incomingCategory}"`)
              }
              if (incomingDate) {
                const d = new Date(incomingDate)
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                const formattedDate = isNaN(d.getTime()) ? incomingDate : `${monthNames[d.getMonth()]} ${d.getDate()}${getSuffix(d.getDate())}, ${d.getFullYear()}`
                filterDetails.push(`date ${formattedDate}`)
              }
              if (incomingTxType) {
                filterDetails.push(incomingTxType === 'inflow' ? "inflows only" : "outflows only")
              }

              if (filterDetails.length > 0) {
                return `Showing ${parts.join(', ')} — filtered by ${filterDetails.join(' and ')}`
              }
              return `Showing ${parts.join(', ')}`
            })()}
          </div>
          <button
            onClick={() => {
              onClearIncomingFilters?.()
              onClearAllCycles?.()
              setSelectedFilters([])
              setSelectedDateFilter(null)
              setSelectedTxTypeFilter(null)
            }}
            className="flex items-center gap-1 text-blue-500/70 hover:text-blue-500 text-[10px] font-semibold transition cursor-pointer"
          >
            <X className="size-3" /> Clear filter
          </button>
        </div>
      )}

      {/* Expandable Post Transaction Form */}
      {showAddForm && (
        <div ref={formRef} className="p-6 rounded-2xl bg-card border border-blue-500/20 shadow-md animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-md font-semibold text-foreground mb-4 flex items-center gap-2">
            <PlusCircle className="size-4 text-blue-500" /> {editingTxId ? 'Edit Ledger Entry' : 'Post New Ledger Entry'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Transaction Type</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTxType('outflow')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                    txType === 'outflow' 
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' 
                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <MinusCircle className="size-3.5" /> Outflow (Debit)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('inflow')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                    txType === 'inflow' 
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <PlusCircle className="size-3.5" /> Inflow (Credit)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('transfer')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border transition cursor-pointer ${
                    txType === 'transfer' 
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                      : 'border-border hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <RefreshCw className="size-3.5" /> Transfer
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Description</label>
              <input
                ref={firstInputRef}
                type="text"
                required
                placeholder="e.g. Grocery Store, Paycheck"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Amount ({getCurrencySymbol(currency)})</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-xs font-semibold text-muted-foreground pointer-events-none select-none">
                  {getCurrencySymbol(currency)}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className={`w-full pr-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200 ${
                    getCurrencySymbol(currency).length > 2 ? 'pl-11' : getCurrencySymbol(currency).length > 1 ? 'pl-9' : 'pl-7'
                  }`}
                />
              </div>
            </div>

            {txType === 'transfer' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Source Category (From)</label>
                  <CustomSelect
                    value={transferSource}
                    onChange={val => setTransferSource(val)}
                    options={[
                      { value: 'Essentials', label: 'Essentials' },
                      { value: 'Growth', label: 'Growth' },
                      { value: 'Stability', label: 'Stability' },
                      { value: 'Rewards', label: 'Rewards' }
                    ]}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Target Category (To)</label>
                  <CustomSelect
                    value={transferTarget}
                    onChange={val => setTransferTarget(val)}
                    options={[
                      { value: 'Essentials', label: 'Essentials' },
                      { value: 'Growth', label: 'Growth' },
                      { value: 'Stability', label: 'Stability' },
                      { value: 'Rewards', label: 'Rewards' }
                    ]}
                    className="w-full"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Category</label>
                  <CustomSelect
                    value={category || (categories[0]?.name || '')}
                    onChange={val => setCategory(val)}
                    options={categories.map(c => ({ value: c.name, label: c.name }))}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Ledger Category</label>
                  <CustomSelect
                    value={ledgerCategory}
                    onChange={val => setLedgerCategory(val)}
                    options={[
                      ...(txType === 'inflow' ? [{ value: 'Income', label: 'Income (Auto-Split)' }] : []),
                      { value: 'Essentials', label: 'Essentials' },
                      { value: 'Growth', label: 'Growth' },
                      { value: 'Stability', label: 'Stability' },
                      { value: 'Rewards', label: 'Rewards' }
                    ]}
                    className="w-full"
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Posting Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            <div className="md:col-span-3 pt-2">
              <button
                type="submit"
                className="w-full md:w-auto px-6 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition duration-200 cursor-pointer"
              >
                {editingTxId ? 'Update Entry' : 'Post Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs">
        {showAllCycles ? (
          /* Server mode: unified pill search bar */
          <div className="flex items-center w-full md:w-auto">
            <div className="flex items-center flex-1 md:w-80 bg-background border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/60 focus-within:border-blue-500/40 transition duration-200">
              <Search className="size-4 text-muted-foreground ml-3 shrink-0" />
              <input
                type="text"
                placeholder="Search all history..."
                value={pendingSearchTerm}
                onChange={e => setPendingSearchTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleServerSearch() }}
                className="flex-1 px-2.5 py-2 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={handleServerSearch}
                disabled={serverIsFetching}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer transition duration-200 border-l border-blue-700/30 shrink-0 self-stretch"
              >
                {serverIsFetching
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Search className="size-3.5" />}
                <span>Search</span>
              </button>
            </div>
          </div>
        ) : (
          /* Client mode: standard search input */
          <div className="w-full md:w-72 relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search descriptions, ledger categories..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
            />
          </div>
        )}

        {/* Dropdown Multi-Select Category Filter */}
        <div className="relative ledger-filter-dropdown w-full md:w-auto flex justify-start md:justify-end">
          <button
            onClick={() => setIsFilterDropdownOpen(prev => !prev)}
            className="w-full md:w-60 flex items-center justify-between gap-2 px-4 py-2 text-xs font-semibold bg-background border border-border rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none border-border/60"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="size-3.5" />
              <span className="truncate">
                {showAllCycles
                  ? (appliedFilters.length === 0 ? 'All Ledger & Subcategories' : `${appliedFilters.length} filter${appliedFilters.length > 1 ? 's' : ''} applied`)
                  : (selectedFilters.length === 0 ? 'All Ledger & Subcategories' : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`)}
              </span>
            </span>
            <span className="text-[9px] text-muted-foreground">▼</span>
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute right-0 top-11 w-64 bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
                <span className="text-xs font-bold text-foreground">Filter Ledger Entries</span>
                {(showAllCycles ? pendingFilters : selectedFilters).length > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Scrollable sections */}
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                
                {/* Section 1: Ledger Allocation Buckets */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Buckets</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'].map(bucket => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(bucket)
                      return (
                        <label 
                          key={bucket} 
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                            isChecked 
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 font-semibold' 
                              : 'bg-background/50 border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(bucket)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                          />
                          <span>{bucket}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Section 2: Transaction Subcategories */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Subcategories</span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                    {categories.map(c => {
                      const isChecked = (showAllCycles ? pendingFilters : selectedFilters).includes(c.name)
                      return (
                        <label 
                          key={c.id} 
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition ${
                            isChecked 
                              ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 font-semibold' 
                              : 'bg-background/50 border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleFilter(c.name)}
                            className="rounded border-border text-blue-500 focus:ring-blue-500 size-3"
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Apply button — only in server mode */}
              {showAllCycles && (
                <div className="pt-3 mt-3 border-t border-border/40">
                  <button
                    onClick={handleApplyFilters}
                    disabled={serverIsFetching}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs cursor-pointer transition duration-200 disabled:opacity-50
                      bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600
                      text-white shadow-md shadow-blue-600/20 hover:shadow-blue-600/30"
                  >
                    {serverIsFetching
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Filter className="size-3.5" />}
                    Apply Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table - Desktop */}
      <div className="hidden md:block overflow-hidden border border-border/60 rounded-2xl bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground select-none">
                <th className="p-4">Date</th>
                <th className="p-4">Description</th>
                <th className="p-4">Category</th>
                <th className="p-4">Ledger Category</th>
                <th className="p-4 text-right text-orange-500/90 font-bold">Debit (Outflow)</th>
                <th className="p-4 text-right text-blue-500/90 font-bold">Credit (Inflow)</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-xs">
              {displayTransactions.map(t => {
                const isOutflow = t.amount < 0
                return (
                  <tr id={`tx-row-${t.id}`} key={t.id} className="hover:bg-muted/10 transition duration-150">
                    <td className="p-4 font-medium text-muted-foreground">{t.date}</td>
                    <td className="p-4 font-semibold text-foreground">{t.description}</td>
                    <td className="p-4">
                      <span className={`inline-block text-[10px] px-2 py-0.5 font-semibold rounded-md border ${
                        categoryColorMap[t.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      }`}>
                        {t.category}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-muted-foreground">{displayLedgerCategory(t.ledgerCategory)}</td>
                    <td className="p-4 text-right font-medium">
                      {(() => {
                        const isIncomeRecord = t.ledgerCategory === 'Income' || t.ledgerCategory.startsWith('IncomeSplit:')
                        const isSplitSub = t.id.includes('-split-')
                        if (isIncomeRecord) {
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                              {formatSensitive(t.amount)}
                            </span>
                          )
                        }
                        if (isSplitSub) {
                          return <span className="text-muted-foreground/30">-</span>
                        }
                        if (t.ledgerCategory.startsWith('Transfer:')) {
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                              {formatSensitive(t.amount)}
                            </span>
                          )
                        }
                        return isOutflow ? (
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                            {formatSensitive(Math.abs(t.amount))}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )
                      })()}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {(() => {
                        const isIncomeRecord = t.ledgerCategory === 'Income' || t.ledgerCategory.startsWith('IncomeSplit:')
                        const isSplitSub = t.id.includes('-split-')
                        if (isIncomeRecord) {
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                              {formatSensitive(t.amount)}
                            </span>
                          )
                        }
                        if (isSplitSub) {
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                              {formatSensitive(t.amount)}
                            </span>
                          )
                        }
                        if (t.ledgerCategory.startsWith('Transfer:')) {
                          return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                              {formatSensitive(t.amount)}
                            </span>
                          )
                        }
                        return !isOutflow ? (
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                            {formatSensitive(t.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )
                      })()}
                    </td>
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      {t.id.includes('-split-') ? (
                        <button
                          onClick={() => setShowEditDisabledModal(true)}
                          className="text-xs text-muted-foreground/45 hover:text-muted-foreground/60 bg-muted/20 hover:bg-muted/30 border border-border/40 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartEdit(t)}
                          className="text-xs text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(t)}
                        className="text-xs text-orange-500 hover:text-orange-600 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}

              {displayTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {serverIsFetching ? 'Loading...' : 'No transactions match your search or filter criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger List - Mobile */}
      <div className="block md:hidden space-y-3">
        {displayTransactions.map(t => {
          const isOutflow = t.amount < 0
          const isTransfer = t.ledgerCategory.startsWith('Transfer:')
          const isSplit = t.id.includes('-split-')
          const ledgerLabel = displayLedgerCategory(t.ledgerCategory)

          return (
            <div id={`tx-row-${t.id}`} key={t.id} className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              {/* Top accent bar */}
              <div className={`h-0.5 w-full ${
                isTransfer ? 'bg-blue-500/60' : isOutflow ? 'bg-orange-500/60' : 'bg-emerald-500/60'
              }`} />

              <div className="p-4 space-y-3">
                {/* Row 1: Date + Category badge */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono tracking-wide">{t.date}</span>
                  <span className={`inline-block text-[10px] px-2 py-0.5 font-semibold rounded-full border ${
                    categoryColorMap[t.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                  }`}>
                    {t.category}
                  </span>
                </div>

                {/* Row 2: Description + Amount */}
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-foreground leading-snug flex-1">{t.description}</h4>
                  <div className="shrink-0">
                    {isTransfer ? (
                      <span className="text-sm font-bold text-blue-400">
                        {formatSensitive(t.amount)}
                      </span>
                    ) : (
                      <span className={`text-sm font-bold ${
                        isOutflow ? 'text-orange-400' : 'text-emerald-400'
                      }`}>
                        {isOutflow ? '-' : '+'}{formatSensitive(isOutflow ? Math.abs(t.amount) : t.amount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 3: Ledger category + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground">
                    Ledger: <span className="font-semibold text-foreground/70">{ledgerLabel}</span>
                  </span>
                  <div className="flex gap-1.5">
                    {isSplit ? (
                      <button
                        onClick={() => setShowEditDisabledModal(true)}
                        className="text-[10px] text-muted-foreground/40 bg-muted/10 border border-border/30 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(t)}
                        className="text-[10px] text-blue-500 bg-blue-500/8 hover:bg-blue-500/15 border border-blue-500/15 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteClick(t)}
                      className="text-[10px] text-orange-500 bg-orange-500/8 hover:bg-orange-500/15 border border-orange-500/15 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {displayTransactions.length === 0 && (
          <div className="p-8 text-center text-muted-foreground border border-border/60 rounded-2xl bg-card text-xs">
            {serverIsFetching ? 'Loading...' : 'No transactions match your search or filter criteria.'}
          </div>
        )}
      </div>

      {/* Unified Pagination Controls */}
      {(() => {
        const isServerMode = showAllCycles && !!serverResult
        const displayTotal = isServerMode ? serverResult!.total : filteredTransactions.length
        const displayTotalPages = isServerMode
          ? Math.ceil(serverResult!.total / pageSize) || 1
          : totalPages
        const displayFrom = (currentPage - 1) * pageSize + 1
        const displayTo = Math.min(currentPage * pageSize, displayTotal)
        if (displayTotal === 0) return null
        return (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card border border-border/60 rounded-2xl shadow-xs text-xs select-none">
            <div className="text-muted-foreground font-medium flex items-center gap-2">
              {isServerMode && serverIsFetching && <Loader2 className="size-3.5 animate-spin text-blue-500" />}
              Showing <span className="text-foreground font-semibold">{displayFrom}</span> to{' '}
              <span className="text-foreground font-semibold">{displayTo}</span>{' '}
              of <span className="text-foreground font-semibold">{displayTotal}</span> entries
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Page size select dropdown selector */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Rows per page:</span>
                <CustomSelect
                  value={pageSize}
                  onChange={(val) => {
                    setPageSize(parseInt(val))
                    setCurrentPage(1)
                  }}
                  options={[
                    { value: 10, label: '10' },
                    { value: 25, label: '25' },
                    { value: 50, label: '50' },
                    { value: 100, label: '100' }
                  ]}
                  className="w-24"
                />
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Prev
                  </button>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Page {currentPage} / {displayTotalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayTotalPages))}
                    disabled={currentPage === displayTotalPages || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1 || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Previous
                  </button>
                  {renderPageNumbers(displayTotalPages)}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayTotalPages))}
                    disabled={currentPage === displayTotalPages || serverIsFetching}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-blue-500 pb-2 border-b border-border/40">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Download className="size-5" />
              </span>
              <h3 className="text-md font-bold text-foreground">Export Ledger CSV</h3>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>
                Choose whether to export the current page or the full result set based on your active filters.
              </p>
              <p className="text-[10px] text-muted-foreground/80">
                Full exports use a server-side download to avoid large client loads.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExportPage}
                disabled={exportIsFetching}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Export This Page
              </button>
              <button
                type="button"
                onClick={handleExportAll}
                disabled={exportIsFetching}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {exportIsFetching && <Loader2 className="size-3.5 animate-spin" />}
                Export Entire Result
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={exportIsFetching}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showStabilityCapModal && pendingTxData && (() => {
        const isCapReached = stabilityBalance >= stabilityTarget
        const defaultStabilityContribution = pendingTxData.amount * stabilityAlloc
        const stabilityNeeded = Math.max(0, stabilityTarget - stabilityBalance)
        const overflowAmt = isCapReached ? defaultStabilityContribution : (defaultStabilityContribution - stabilityNeeded)

        const previewAlloc = calcRedirectionSplits(!isRedirectMode, selectedRedirectCategories)
        const totalAmt = pendingTxData.amount

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                    <PlusCircle className="size-5" />
                  </span>
                  <h3 className="text-md font-bold text-foreground">
                    {isCapReached ? 'Stability Cap Threshold Reached' : 'Stability Fund Overflow Detected'}
                  </h3>
                </div>
                <button 
                  onClick={handleCancelStabilityCapModal}
                  className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Your Stability Fund target is <span className="font-semibold text-foreground">{formatSensitive(stabilityTarget)}</span> (Current balance: <span className="font-semibold text-blue-500">{formatSensitive(stabilityBalance)}</span>).
                </p>
                
                {isCapReached ? (
                  <p className="text-muted-foreground">
                    Since the Stability Fund is already fully funded, the Stability portion of <span className="font-semibold text-foreground">{(stabilityAlloc * 100).toFixed(1)}% ({formatSensitive(defaultStabilityContribution)})</span> from this <span className="font-semibold text-foreground">{formatSensitive(pendingTxData.amount)}</span> transaction can be redirected.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    This transaction requires <span className="font-semibold text-foreground">{formatSensitive(stabilityNeeded)}</span> to fully fund the Stability target. The remaining <span className="font-semibold text-orange-500">{formatSensitive(overflowAmt)}</span> is an overflow amount and can be redirected.
                  </p>
                )}

                <div className="space-y-4 mt-4">
                  {/* Allocation Mode Choice */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-semibold">
                    <label
                      onClick={() => setIsRedirectMode(false)}
                      className={`flex flex-col gap-1 p-3 rounded-xl border transition cursor-pointer select-none ${
                        !isRedirectMode
                          ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">Keep Default Allocation</span>
                        <input
                          type="radio"
                          name="allocationMode"
                          checked={!isRedirectMode}
                          onChange={() => setIsRedirectMode(false)}
                          className="size-3.5 text-blue-600 border-border focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-normal leading-relaxed">
                        Deposit into Stability anyway, exceeding target cap.
                      </p>
                    </label>

                    <label
                      onClick={() => setIsRedirectMode(true)}
                      className={`flex flex-col gap-1 p-3 rounded-xl border transition cursor-pointer select-none ${
                        isRedirectMode
                          ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/30'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">Redirect Stability Overflow</span>
                        <input
                          type="radio"
                          name="allocationMode"
                          checked={isRedirectMode}
                          onChange={() => setIsRedirectMode(true)}
                          className="size-3.5 text-blue-600 border-border focus:ring-blue-500"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-normal leading-relaxed">
                        Redistribute the overflow portion to selected categories.
                      </p>
                    </label>
                  </div>

                  {/* Redirection Multi-select Checklist */}
                  {isRedirectMode && (
                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <span className="font-bold text-foreground">Redirect Targets (Multi-select)</span>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Select one or more categories
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {[
                          { value: 'Rewards', label: 'Rewards', isRecommended: true },
                          { value: 'Essentials', label: 'Essentials', isRecommended: false },
                          { value: 'Growth', label: 'Growth', isRecommended: false }
                        ].map((target) => {
                          const isChecked = selectedRedirectCategories.includes(target.value as any)
                          return (
                            <label
                              key={target.value}
                              onClick={(e) => {
                                e.preventDefault()
                                handleToggleCategory(target.value as any)
                              }}
                              className={`relative flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer select-none transition ${
                                isChecked
                                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 font-bold'
                                  : 'bg-background/50 border-border hover:bg-muted text-muted-foreground'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded border-border text-blue-500 focus:ring-blue-500 size-3.5"
                              />
                              <div className="flex flex-col">
                                <span className="leading-tight">{target.label}</span>
                                {target.isRecommended && (
                                  <span className="text-[8px] font-bold text-emerald-500 mt-0.5">
                                    Recommended
                                  </span>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Allocation Preview Grid */}
                  <div className="p-4 rounded-xl border border-border/60 bg-background/50">
                    <h4 className="font-bold text-foreground mb-3">Live Split Preview</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-semibold">Essentials</span>
                        <span className="text-foreground font-bold font-mono text-sm">{(previewAlloc.ess * 100).toFixed(1)}%</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatSensitive(totalAmt * previewAlloc.ess)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-semibold">Growth</span>
                        <span className="text-foreground font-bold font-mono text-sm">{(previewAlloc.gro * 100).toFixed(1)}%</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatSensitive(totalAmt * previewAlloc.gro)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-semibold">Stability</span>
                        <span className={`font-bold font-mono text-sm ${previewAlloc.sta === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>{(previewAlloc.sta * 100).toFixed(1)}%</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatSensitive(totalAmt * previewAlloc.sta)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground font-semibold">Rewards</span>
                        <span className="text-foreground font-bold font-mono text-sm">{(previewAlloc.rew * 100).toFixed(1)}%</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatSensitive(totalAmt * previewAlloc.rew)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border/40 pt-4 mt-2">
                <button
                  type="button"
                  onClick={handleCancelStabilityCapModal}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isRedirectMode && selectedRedirectCategories.length === 0}
                  onClick={handleConfirmStabilityCapSplit}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white text-xs font-semibold shadow-md transition cursor-pointer"
                >
                  Confirm Allocation
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showDeleteModal && txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-orange-500 pb-2 border-b border-border/40">
              <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
                <AlertCircle className="size-5" />
              </span>
              <h3 className="text-md font-bold text-foreground">Confirm Deletion</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              {txToDelete.id.includes('-split-') ? (
                <p>
                  This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> of an Income Auto-Split. Deleting it will delete the main Income record and all other category splits associated with it.
                </p>
              ) : (txToDelete.ledgerCategory === 'Income' || txToDelete.ledgerCategory.startsWith('IncomeSplit:')) ? (
                <p>
                  This is the <span className="font-semibold text-foreground">main Income Auto-Split record</span>. Deleting it will delete all its associated category sub-split records as well.
                </p>
              ) : (
                <p>
                  Are you sure you want to delete this transaction: <span className="font-semibold text-foreground">"{txToDelete.description}"</span> of <span className="font-bold text-foreground">{formatSensitive(txToDelete.amount)}</span>?
                </p>
              )}
              <p className="text-[10px] text-orange-500/90 font-medium bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
                Warning: This action is permanent and cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditDisabledModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-blue-500 pb-2 border-b border-border/40">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <AlertCircle className="size-5" />
              </span>
              <h3 className="text-md font-bold text-foreground">Editing Disabled</h3>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> generated automatically from an Income Auto-Split.
              </p>
              <p>
                To edit this transaction's amount, description, or split allocations, please find and edit the main <span className="font-semibold text-foreground">Income (Auto-Split)</span> record.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEditDisabledModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getSuffix(d: number): string {
  if (d >= 11 && d <= 13) return 'th'
  switch (d % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

function getCycleLabelForDropdown(month: string, year: number, cycleDay: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIdx = months.indexOf(month)
  if (monthIdx === -1) return month

  if (cycleDay === 1) {
    const days = new Date(year, monthIdx + 1, 0).getDate()
    return `${month} 1st ~ ${month} ${days}${getSuffix(days)}`
  }

  const startDayActual = Math.min(cycleDay, new Date(year, monthIdx + 1, 0).getDate())
  const startDate = new Date(year, monthIdx, startDayActual)
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 1)
  endDate.setDate(endDate.getDate() - 1)

  const startMonthStr = months[startDate.getMonth()]
  const endMonthStr = months[endDate.getMonth()]

  return `${startMonthStr} ${startDate.getDate()}${getSuffix(startDate.getDate())} ~ ${endMonthStr} ${endDate.getDate()}${getSuffix(endDate.getDate())}`
}
