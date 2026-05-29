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

interface LedgerViewProps {
  transactions: Transaction[]
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void
  onDeleteTransaction: (id: string) => void
  hideSensitive: boolean
  categories: TransactionCategory[]
  cycleLabel: string
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  onAddTransaction,
  onDeleteTransaction,
  hideSensitive,
  categories,
  cycleLabel
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
  const [selectedCategory, setSelectedCategory] = useState('All')

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

    onAddTransaction({
      description,
      amount: finalAmount,
      category: txType === 'transfer' ? 'Other' : category,
      ledgerCategory: finalLedgerCategory,
      date
    })

    // Reset fields
    setDescription('')
    setAmount('')
    setLedgerCategory('Essentials')
    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setDate(`${y}-${mo}-${d}`)
    setShowAddForm(false)
  }

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            t.ledgerCategory.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory
      return matchesSearch && matchesCategory
    }).sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateDiff !== 0) return dateDiff
      return b.id.localeCompare(a.id)
    })
  }, [transactions, searchTerm, selectedCategory])

  const displayLedgerCategory = (cat: string) => {
    if (cat.startsWith('IncomeSplit:')) return 'Income'
    if (cat.startsWith('Transfer:')) {
      const parts = cat.replace('Transfer:', '').split('->')
      return `Transfer: ${parts[0]} → ${parts[1]}`
    }
    return cat
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }

  const formatSensitive = (val: number) => {
    return hideSensitive ? '$ ••,•••.••' : formatCurrency(val)
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
            {cycleLabel && (
              <span className="px-2.5 py-1 text-[11px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg">
                {cycleLabel}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Comprehensive posting of all accounts and transactional balances for the currently selected cycle.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition duration-200 cursor-pointer"
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddForm(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition duration-200 cursor-pointer"
          >
            {showAddForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showAddForm ? 'Cancel' : 'Post Transaction'}
          </button>
        </div>
      </div>

      {/* Expandable Post Transaction Form */}
      {showAddForm && (
        <div className="p-6 rounded-2xl bg-card border border-blue-500/20 shadow-md animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-md font-semibold text-foreground mb-4 flex items-center gap-2">
            <PlusCircle className="size-4 text-blue-500" /> Post New Ledger Entry
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
              <label className="text-xs font-semibold text-muted-foreground">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
              />
            </div>

            {txType === 'transfer' ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Source Category (From)</label>
                  <select
                    value={transferSource}
                    onChange={e => setTransferSource(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                  >
                    <option value="Essentials">Essentials</option>
                    <option value="Growth">Growth</option>
                    <option value="Stability">Stability</option>
                    <option value="Rewards">Rewards</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Target Category (To)</label>
                  <select
                    value={transferTarget}
                    onChange={e => setTransferTarget(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                  >
                    <option value="Essentials">Essentials</option>
                    <option value="Growth">Growth</option>
                    <option value="Stability">Stability</option>
                    <option value="Rewards">Rewards</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Category</label>
                  <select
                    value={category || (categories[0]?.name || '')}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Ledger Category</label>
                  <select
                    value={ledgerCategory}
                    onChange={e => setLedgerCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition duration-200"
                  >
                    {txType === 'inflow' && <option value="Income">Income (Auto-Split)</option>}
                    <option value="Essentials">Essentials</option>
                    <option value="Growth">Growth</option>
                    <option value="Stability">Stability</option>
                    <option value="Rewards">Rewards</option>
                  </select>
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
                Post Entry
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-muted/30 border border-border/60 rounded-2xl">
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

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mr-2">
            <Filter className="size-3.5" /> Category Filter:
          </span>
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 text-xs rounded-xl font-medium cursor-pointer border transition duration-150 ${
              selectedCategory === 'All' 
                ? 'bg-foreground text-background border-foreground' 
                : 'border-border hover:bg-muted bg-background text-muted-foreground'
            }`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.name)}
              className={`px-3 py-1.5 text-xs rounded-xl font-medium cursor-pointer border transition duration-150 ${
                selectedCategory === c.name 
                  ? 'bg-foreground text-background border-foreground' 
                  : 'border-border hover:bg-muted bg-background text-muted-foreground'
              }`}
            >
              {c.name}
            </button>
          ))}
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
                    <td className="p-4 text-center">
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
                      {isOutflow ? `-${formatSensitive(Math.abs(t.amount))}` : `+${formatSensitive(t.amount)}`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t border-border/30">
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
