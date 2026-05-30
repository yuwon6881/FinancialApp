import React, { useState, useMemo, useEffect } from 'react'
import type { Transaction, TransactionCategory } from '../types'
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  X,
  PlusCircle,
  MinusCircle,
  RefreshCw
} from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { formatCurrencyVal, getCurrencySymbol } from '../lib/utils'

interface LedgerViewProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
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
  onClearIncomingFilters?: () => void
  showAllCycles: boolean
  onLoadAllTransactions: () => void
  onClearAllCycles: () => void
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly'
  currency?: string
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
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
  } else {
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
  allTransactions,
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
  onClearIncomingFilters,
  showAllCycles,
  onLoadAllTransactions: _onLoadAllTransactions,
  onClearAllCycles,
  cyclesRange,
  currency = 'USD',
  autoOpenAddForm,
  onResetAutoOpen
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

  useEffect(() => {
    if (autoOpenAddForm) {
      setShowAddForm(true)
      onResetAutoOpen?.()
    }
  }, [autoOpenAddForm, onResetAutoOpen])

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

  // Reset Ledger Category to Essentials if user switches to outflow (since Income is inflow only)
  useEffect(() => {
    if (txType === 'outflow' && ledgerCategory === 'Income') {
      setLedgerCategory('Essentials')
    }
  }, [txType, ledgerCategory])

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
    setSelectedFilters(prev => {
      if (prev.includes(filterName)) {
        return prev.filter(f => f !== filterName)
      } else {
        return [...prev, filterName]
      }
    })
  }

  const handleClearFilters = () => {
    setSelectedFilters([])
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

    if (editingTxId) {
      onUpdateTransaction?.(editingTxId, {
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Other' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
    } else {
      onAddTransaction({
        description,
        amount: finalAmount,
        category: txType === 'transfer' ? 'Other' : category,
        ledgerCategory: finalLedgerCategory,
        date
      })
    }

    // Reset fields
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

  // Source: all transactions across all cycles when showAllCycles, else current cycle only
  const sourceTransactions = useMemo(() => {
    if (!showAllCycles || !allTransactions || allTransactions.length === 0) {
      return transactions
    }

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const activeMonthIdx = MONTH_NAMES.indexOf(selectedMonth) + 1
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

    if (startDate && endDate) {
      const startStr = formatDateToString(startDate)
      const endStr = formatDateToString(endDate)
      return allTransactions.filter(t => t.date >= startStr && t.date <= endStr)
    }

    return allTransactions
  }, [showAllCycles, allTransactions, transactions, selectedMonth, selectedYear, cycleDay, cyclesRange])

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

  const displayLedgerCategory = (cat: string) => {
    if (cat.startsWith('IncomeSplit:')) return 'Income'
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

  // CSV export with proper quoting
  const escapeCsvField = (val: string | number) => {
    const str = String(val)
    // Wrap in quotes if it contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const exportToCSV = () => {
    if (hideSensitive) return
    const headers = ['Date', 'Description', 'Category', 'Ledger Category', 'Debit (Outflow)', 'Credit (Inflow)']
    const rows = filteredTransactions.map(t => {
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
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
      
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `financial_ledger_${new Date().toLocaleDateString('en-CA')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
            onClick={exportToCSV}
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
                filterDetails.push(`category "${incomingCategory}"`)
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
        <div className="p-6 rounded-2xl bg-card border border-blue-500/20 shadow-md animate-in slide-in-from-top-4 duration-300">
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

        {/* Dropdown Multi-Select Category Filter */}
        <div className="relative ledger-filter-dropdown w-full md:w-auto flex justify-start md:justify-end">
          <button
            onClick={() => setIsFilterDropdownOpen(prev => !prev)}
            className="w-full md:w-60 flex items-center justify-between gap-2 px-4 py-2 text-xs font-semibold bg-background border border-border rounded-xl hover:bg-muted transition duration-200 cursor-pointer select-none border-border/60"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Filter className="size-3.5" />
              <span className="truncate">
                {selectedFilters.length === 0 
                  ? 'All Ledger & Subcategories' 
                  : `${selectedFilters.length} filter${selectedFilters.length > 1 ? 's' : ''} active`}
              </span>
            </span>
            <span className="text-[9px] text-muted-foreground">▼</span>
          </button>

          {isFilterDropdownOpen && (
            <div className="absolute right-0 top-11 w-64 bg-card border border-border rounded-2xl shadow-xl p-4 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-3">
                <span className="text-xs font-bold text-foreground">Filter Ledger Entries</span>
                {selectedFilters.length > 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[9px] font-bold text-orange-500 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Scrollable sections */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                
                {/* Section 1: Ledger Allocation Buckets */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Ledger Buckets</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {['Essentials', 'Growth', 'Stability', 'Rewards', 'Income'].map(bucket => {
                      const isChecked = selectedFilters.includes(bucket)
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
                      const isChecked = selectedFilters.includes(c.name)
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
              {filteredTransactions.map(t => {
                const isOutflow = t.amount < 0
                return (
                  <tr key={t.id} className="hover:bg-muted/10 transition duration-150">
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
                      {t.ledgerCategory.startsWith('Transfer:') ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                          {formatSensitive(t.amount)}
                        </span>
                      ) : isOutflow ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500 font-bold text-xs">
                          {formatSensitive(Math.abs(t.amount))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {t.ledgerCategory.startsWith('Transfer:') ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                          {formatSensitive(t.amount)}
                        </span>
                      ) : !isOutflow ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                          {formatSensitive(t.amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleStartEdit(t)}
                        className="text-xs text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(t.id)}
                        className="text-xs text-orange-500 hover:text-orange-600 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 px-2.5 py-1 rounded-lg transition duration-150 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    No transactions match your search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger List - Mobile */}
      <div className="block md:hidden space-y-4">
        {filteredTransactions.map(t => {
          const isOutflow = t.amount < 0
          return (
            <div key={t.id} className="p-4 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-medium">{t.date}</span>
                <span className={`inline-block text-[10px] px-2 py-0.5 font-semibold rounded-md border ${
                  categoryColorMap[t.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                }`}>
                  {t.category}
                </span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground leading-tight">{t.description}</h4>
                  <p className="text-[10px] text-muted-foreground">Ledger: <span className="font-semibold">{displayLedgerCategory(t.ledgerCategory)}</span></p>
                </div>
                <div className="text-right">
                  {t.ledgerCategory.startsWith('Transfer:') ? (
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs">
                      {formatSensitive(t.amount)}
                    </span>
                  ) : (
                    <span className={`inline-block px-2.5 py-1 rounded-lg font-bold text-xs ${
                      isOutflow ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {isOutflow ? '-' : '+'}{formatSensitive(isOutflow ? Math.abs(t.amount) : t.amount)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                <button
                  onClick={() => handleStartEdit(t)}
                  className="text-[11px] text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer"
                >
                  Edit Entry
                </button>
                <button
                  onClick={() => onDeleteTransaction(t.id)}
                  className="text-[11px] text-orange-500 hover:text-orange-600 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 hover:border-orange-500/20 px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer"
                >
                  Delete Entry
                </button>
              </div>
            </div>
          )
        })}

        {filteredTransactions.length === 0 && (
          <div className="p-8 text-center text-muted-foreground border border-border/60 rounded-2xl bg-card text-xs">
            No transactions match your search or filter criteria.
          </div>
        )}
      </div>
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
