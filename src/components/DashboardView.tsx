import React, { useState, useMemo } from 'react'
import type { DashboardData } from '../types'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  Settings,
  Save,
  AlertCircle,
  TrendingUp as TrendLineIcon
} from 'lucide-react'
import type { TransactionCategory } from '../types'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  onSelectPeriod: (month: string, year: number) => void
  onUpdateSettings: (settings: {
    monthlyIncome: number
    targetStabilityFund: number
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    cycleDay: number
  }) => void
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger') => void
  hideSensitive: boolean
  categoriesList: TransactionCategory[]
  onAddCategory: (category: Omit<TransactionCategory, 'id'>) => void
  onDeleteCategory: (id: string) => void
  onConfirmSubscription: (noti: any, paidDate: string) => void
  onDeletePayment: (id: string) => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  dashboardData,
  onSelectPeriod,
  onUpdateSettings,
  onNavigate,
  hideSensitive,
  categoriesList,
  onAddCategory,
  onDeleteCategory,
  onConfirmSubscription,
  onDeletePayment
}) => {
  const [showSettings, setShowSettings] = useState(false)
  const [incomeInput, setIncomeInput] = useState('')
  const [targetInput, setTargetInput] = useState('')
  
  // Custom Allocations & Cycle setting states
  const [essentialsAllocInput, setEssentialsAllocInput] = useState('')
  const [growthAllocInput, setGrowthAllocInput] = useState('')
  const [stabilityAllocInput, setStabilityAllocInput] = useState('')
  const [rewardsAllocInput, setRewardsAllocInput] = useState('')
  const [cycleDayInput, setCycleDayInput] = useState('28')

  // Custom Category Forms State
  const [newCatName, setNewCatName] = useState('')

  // Subcategory Pie Chart States
  const [chartView, setChartView] = useState<'monthly' | '3month' | '6month' | 'yearly'>('monthly')
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null)
  // Wealth Growth trend view state
  const [trendView, setTrendView] = useState<'monthly' | '3month' | '6month' | 'yearly'>('yearly')

  // Subscription Confirmation States
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null)
  const [paidDateInput, setPaidDateInput] = useState('')

  // Subcategory custom colors mapping
  const categoryColorHex: Record<string, string> = {
    'Salary': '#3b82f6',
    'Social': '#ec4899',
    'Food': '#f59e0b',
    'Hobbies': '#14b8a6',
    'Software': '#6366f1',
    'Investment': '#8b5cf6',
    'Entertainment': '#f97316',
    'Transport': '#a855f7',
    'Other': '#64748b',
  }
  const getCategoryColor = (name: string) => categoryColorHex[name] || '#64748b'

  const breakdownData = useMemo(() => {
    if (chartView === 'yearly') return dashboardData?.yearlyCategoryBreakdown || []
    if (chartView === '3month') return dashboardData?.last3CategoryBreakdown || []
    if (chartView === '6month') return dashboardData?.last6CategoryBreakdown || []
    return dashboardData?.monthlyCategoryBreakdown || []
  }, [chartView, dashboardData])

  const activeTrendPoints = useMemo(() => {
    if (trendView === '3month') return dashboardData?.last3TrendPoints || []
    if (trendView === '6month') return dashboardData?.last6TrendPoints || []
    // 'monthly' = just the current month point (single dot – show full year instead)
    return dashboardData?.trendPoints || []
  }, [trendView, dashboardData])

  const totalBreakdownAmount = useMemo(() => {
    return breakdownData.reduce((sum, item) => sum + item.amount, 0)
  }, [breakdownData])

  const slices = useMemo(() => {
    let currentAngle = 0
    return breakdownData.map((item) => {
      const percentage = totalBreakdownAmount > 0 ? (item.amount / totalBreakdownAmount) : 0
      const angleSweep = percentage * 360
      const startAngle = currentAngle
      const endAngle = Math.min(359.99 + startAngle, startAngle + angleSweep)
      currentAngle += angleSweep
      return {
        category: item.category,
        amount: item.amount,
        percentage,
        startAngle,
        endAngle
      }
    })
  }, [breakdownData, totalBreakdownAmount])

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years = useMemo<number[]>(() => {
    return (dashboardData as any)?.availableYears || [new Date().getFullYear()]
  }, [dashboardData])

  const todayStr = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dateStr = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dateStr}`
  }, [])

  // Extract variables from dashboardData or fall back to defaults
  const activeSettings = dashboardData?.setting || {
    monthlyIncome: 4000.00,
    targetStabilityFund: 10000.00,
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.50,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.10,
    cycleDay: 28
  }

  const cycleLabel = dashboardData?.cycleLabel || 'Jun 28th ~ Jul 27th, 2026'

  const categories = dashboardData?.categories || [
    { name: "Essentials", allocation: 0.50, target: 2000.00, budget: 0, netChange: 0, remaining: 0 },
    { name: "Growth", allocation: 0.25, target: 1000.00, budget: 0, netChange: 0, remaining: 0 },
    { name: "Stability", allocation: 0.15, target: 600.00, budget: 2436.00, netChange: 0, remaining: 2436.00 },
    { name: "Rewards", allocation: 0.10, target: 400.00, budget: 0, netChange: 0, remaining: 0 }
  ]

  const stats = dashboardData?.stats || {
    totalBalance: 2436.00,
    monthlyIncome: 4000.00,
    monthlyInflow: 0.00,
    monthlyExpenses: 0.00,
    activeRecurringTotal: 29.50,
    growthPercentAchieved: 0.0,
    essentialsPercentRemaining: 0.0,
    stabilityPercentReached: 0.2436
  }

  const recentTransactions = dashboardData?.recentTransactions || []
  const activeRecurring = dashboardData?.activeRecurringPayments || []

  const pendingDeductionsByCategory = useMemo(() => {
    const sums: Record<string, number> = {
      'Essentials': 0,
      'Growth': 0,
      'Stability': 0,
      'Rewards': 0
    }
    if (activeRecurring) {
      activeRecurring.forEach((rp: any) => {
        if (!rp.isPaid) {
          const cat = rp.ledgerCategory || rp.category
          if (cat && sums[cat] !== undefined) {
            sums[cat] += Math.abs(rp.amount)
          }
        }
      })
    }
    return sums
  }, [activeRecurring])

  // Initialize input states when opening settings
  const handleToggleSettings = () => {
    if (!showSettings) {
      setIncomeInput(activeSettings.monthlyIncome.toString())
      setTargetInput(activeSettings.targetStabilityFund.toString())
      setEssentialsAllocInput((activeSettings.essentialsAlloc * 100).toString())
      setGrowthAllocInput((activeSettings.growthAlloc * 100).toString())
      setStabilityAllocInput((activeSettings.stabilityAlloc * 100).toString())
      setRewardsAllocInput((activeSettings.rewardsAlloc * 100).toString())
      setCycleDayInput(activeSettings.cycleDay.toString())
    }
    setShowSettings(!showSettings)
  }

  // Calculate allocation sum to enforce 100% rule
  const allocSum = useMemo(() => {
    const e = parseFloat(essentialsAllocInput) || 0
    const g = parseFloat(growthAllocInput) || 0
    const s = parseFloat(stabilityAllocInput) || 0
    const r = parseFloat(rewardsAllocInput) || 0
    return e + g + s + r
  }, [essentialsAllocInput, growthAllocInput, stabilityAllocInput, rewardsAllocInput])

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    if (allocSum !== 100) return

    const income = parseFloat(incomeInput)
    const target = parseFloat(targetInput)
    const ess = (parseFloat(essentialsAllocInput) || 0) / 100
    const gro = (parseFloat(growthAllocInput) || 0) / 100
    const sta = (parseFloat(stabilityAllocInput) || 0) / 100
    const rew = (parseFloat(rewardsAllocInput) || 0) / 100
    const cycle = parseInt(cycleDayInput)

    if (!isNaN(income) && !isNaN(target) && !isNaN(cycle)) {
      onUpdateSettings({
        monthlyIncome: income,
        targetStabilityFund: target,
        essentialsAlloc: ess,
        growthAlloc: gro,
        stabilityAlloc: sta,
        rewardsAlloc: rew,
        cycleDay: cycle
      })
      setShowSettings(false)
    }
  }

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(val)
  }

  const formatSensitive = (val: number) => {
    return (
      <span className={hideSensitive ? 'blur-sm select-none pointer-events-none inline-block transition-all duration-200' : 'transition-all duration-200'}>
        {formatCurrency(val)}
      </span>
    )
  }

  // Generate SVG path for trend line
  const trendLinePoints = useMemo(() => {
    if (activeTrendPoints.length < 2) return ''
    const minVal = Math.min(...activeTrendPoints.map(p => p.balance), 0)
    const maxVal = Math.max(...activeTrendPoints.map(p => p.balance), 1000)
    const range = maxVal - minVal

    const width = 500
    const height = 120
    const padding = 15

    return activeTrendPoints.map((p, index) => {
      const x = padding + (index / (activeTrendPoints.length - 1)) * (width - padding * 2)
      const y = height - padding - ((p.balance - minVal) / (range || 1)) * (height - padding * 2)
      return `${x},${y}`
    }).join(' ')
  }, [activeTrendPoints])

  // Color map for categories
  const categoryColorMap: Record<string, string> = {
    'Salary': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Essentials': 'bg-sky-500/10 text-sky-500 border-sky-500/20',
    'Social': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'Food': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Hobbies': 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    'Software': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    'Growth': 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    'Investment': 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    'Stability': 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    'Entertainment': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Rewards': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'Transport': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Other': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      
      {/* Period Selection & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-radial from-blue-950/20 via-card to-card rounded-2xl border border-blue-500/10">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Ledger Dashboard
          </h2>
          <p className="text-muted-foreground text-xs mt-0.5">
            Active Cycle: <span className="font-semibold text-blue-500">{cycleLabel}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start md:self-center">
          {/* Month Selector */}
          <select 
            value={activeSettings.selectedMonth}
            onChange={(e) => onSelectPeriod(e.target.value, activeSettings.selectedYear)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {months.map(m => (
              <option key={m} value={m}>{getCycleLabelForDropdown(m, activeSettings.selectedYear, activeSettings.cycleDay)}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select 
            value={activeSettings.selectedYear}
            onChange={(e) => onSelectPeriod(activeSettings.selectedMonth, parseInt(e.target.value))}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Configure button */}
          <button 
            onClick={handleToggleSettings}
            className="p-2 border border-border rounded-xl bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition duration-150"
            title="Configure Ledger Constraints"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </div>

      {/* Settings Form Drawer */}
      {showSettings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 rounded-2xl bg-card border border-blue-500/20 shadow-md animate-in slide-in-from-top-4 duration-200">
          
          {/* Column 1: Financial Model settings */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground border-b border-border pb-2">
              <Settings className="size-4 text-blue-500" /> Financial Model Parameters
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Income setting has been hidden as target budgets are now based on actual monthly income */}
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Target Stability Fund Limit ($)</label>
                <input 
                  type="number"
                  required
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Cycle Start Date (Day of Month)</label>
                <select
                  value={cycleDayInput}
                  onChange={e => setCycleDayInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}{GetDayWithSuffix(d)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 border-t border-border/30 pt-4">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-muted-foreground">Adjust Allocations (Must equal 100%)</span>
                <span className={allocSum === 100 ? 'text-blue-500 font-bold' : 'text-orange-500 font-bold'}>
                  Total: {allocSum}% {allocSum !== 100 && ' (Invalid)'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground block">Essentials (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={essentialsAllocInput}
                    onChange={e => setEssentialsAllocInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground block">Growth (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={growthAllocInput}
                    onChange={e => setGrowthAllocInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground block">Stability (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={stabilityAllocInput}
                    onChange={e => setStabilityAllocInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground block">Rewards (%)</label>
                  <input 
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={rewardsAllocInput}
                    onChange={e => setRewardsAllocInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={allocSum !== 100}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shadow-md transition duration-150 ${
                allocSum === 100 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              }`}
            >
              <Save className="size-3.5" /> Save Configuration
            </button>
          </form>

          {/* Column 2: Categories Manager */}
          <div className="space-y-6 border-t lg:border-t-0 lg:border-l border-border/40 pt-6 lg:pt-0 lg:pl-6">
            
            {/* Category list & adding */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm font-bold text-foreground border-b border-border pb-2">
                <span>Manage Categories</span>
                <span className="text-[10px] text-muted-foreground font-normal">Active: {categoriesList.length}</span>
              </div>
              
              {/* Category mini-list */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 select-none">
                {categoriesList.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/60 transition">
                    <span className="font-semibold">{cat.name}</span>
                    <button 
                      type="button"
                      onClick={() => onDeleteCategory(cat.id)}
                      className="text-orange-500 hover:text-orange-600 cursor-pointer font-bold"
                      title="Delete category"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              {/* Add category inline form */}
              <div className="flex gap-2 items-center pt-1.5">
                <input 
                  type="text" 
                  placeholder="New category name"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCatName.trim()) return
                    onAddCategory({ name: newCatName.trim() })
                    setNewCatName('')
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                >
                  + Add
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Pending Subscriptions Notifications Alert */}
      {dashboardData?.pendingNotifications && dashboardData.pendingNotifications.length > 0 && (
        <div className="p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5 text-yellow-500" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground">Pending Subscription Confirmations</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                You have {dashboardData.pendingNotifications.length} subscription billing cycle{dashboardData.pendingNotifications.length > 1 ? 's' : ''} awaiting confirmation.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {dashboardData.pendingNotifications.map((noti) => {
                  const isConfirming = activeConfirmId === noti.id
                  return (
                    <div key={noti.id} className="p-3.5 rounded-xl bg-card border border-border/40 shadow-xs flex flex-col justify-between gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className="font-bold text-foreground text-xs block">{noti.name}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border ${categoryColorMap[noti.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                              {noti.category}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{noti.billingDate}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-orange-500 font-extrabold text-xs block">
                            -{formatSensitive(noti.amount)}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{noti.cycleLabel}</span>
                        </div>
                      </div>

                      {isConfirming ? (
                        <div className="flex flex-col gap-2 p-2 bg-muted/30 border border-border/40 rounded-lg animate-in slide-in-from-bottom-2 duration-200">
                          <label className="text-[10px] font-bold text-muted-foreground">Select Paid Date:</label>
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={paidDateInput}
                              onChange={(e) => setPaidDateInput(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => {
                                onConfirmSubscription(noti, paidDateInput)
                                setActiveConfirmId(null)
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setActiveConfirmId(null)}
                              className="px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold cursor-pointer transition border border-border"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2 border-t border-border/20 pt-2">
                          <button
                            onClick={() => {
                              setActiveConfirmId(noti.id)
                              setPaidDateInput(noti.billingDate)
                            }}
                            className="px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[10px] rounded-lg transition duration-150 cursor-pointer"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => {
                              const confirmResult = window.confirm("Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription.");
                              if (confirmResult) {
                                onDeletePayment(noti.recurringPaymentId);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[10px] rounded-lg transition duration-150 cursor-pointer border border-orange-500/10"
                          >
                            Remove Subscription
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Roll Table (Month Sheet Columns B-E) */}
      <div className="p-6 bg-card border border-border/60 rounded-2xl shadow-xs">
        <h3 className="text-md font-bold text-foreground mb-1">Carryover Rolling Ledgers</h3>
        <p className="text-xs text-muted-foreground mb-4">Starting budget carries forward from previous month's remaining balance.</p>
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground font-semibold">
                <th className="py-2.5">Category</th>
                <th className="py-2.5">Target Alloc.</th>
                <th className="py-2.5 text-right">Target Budget</th>
                <th className="py-2.5 text-right">Start Budget (Carried Over)</th>
                <th className="py-2.5 text-right">Net Change (This Cycle)</th>
                <th className="py-2.5 text-right">Remaining Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-foreground font-medium">
              {categories.map(c => {
                const isNeg = c.remaining < 0
                return (
                  <tr key={c.name} className="hover:bg-muted/10">
                    <td className="py-3 flex items-center gap-1.5 font-bold">
                      <span className={`size-2 rounded-full ${categoryColorMap[c.name]?.split(' ')[0] || 'bg-slate-500'}`} />
                      {c.name}
                    </td>
                    <td className="py-3 text-muted-foreground">{(c.allocation * 100).toFixed(0)}%</td>
                    <td className="py-3 text-right">{formatSensitive(c.target)}</td>
                    <td className="py-3 text-right text-muted-foreground">{formatSensitive(c.budget)}</td>
                    <td className={`py-3 text-right ${c.netChange < 0 ? 'text-orange-500' : c.netChange > 0 ? 'text-blue-500' : ''}`}>
                      <div>{c.netChange > 0 ? '+' : ''}{formatSensitive(c.netChange)}</div>
                      {pendingDeductionsByCategory[c.name] > 0 && (
                        <div className="text-[10px] text-yellow-500 font-normal">
                          (-{formatSensitive(pendingDeductionsByCategory[c.name])})
                        </div>
                      )}
                    </td>
                    <td className={`py-3 text-right font-bold ${isNeg ? 'text-orange-500' : 'text-foreground'}`}>
                      <div>{formatSensitive(c.remaining)}</div>
                      {pendingDeductionsByCategory[c.name] > 0 && (
                        <div className={`text-[10px] font-semibold ${(c.remaining - pendingDeductionsByCategory[c.name]) < 0 ? 'text-orange-500' : 'text-yellow-500'}`}>
                          ({formatSensitive(c.remaining - pendingDeductionsByCategory[c.name])})
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden space-y-4">
          {categories.map(c => {
            const isNeg = c.remaining < 0
            return (
              <div key={c.name} className="p-4 rounded-xl border border-border bg-background/50 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span className={`size-2.5 rounded-full ${categoryColorMap[c.name]?.split(' ')[0] || 'bg-slate-500'}`} />
                    {c.name}
                  </div>
                  <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                    Target: {(c.allocation * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs border-t border-border/30 pt-2.5">
                  <div>
                    <span className="text-muted-foreground text-[10px] block mb-0.5">Target Budget</span>
                    <span className="font-semibold text-foreground">{formatSensitive(c.target)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block mb-0.5">Start (Carried Over)</span>
                    <span className="font-semibold text-foreground">{formatSensitive(c.budget)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs border-t border-border/30 pt-2.5">
                  <div>
                    <span className="text-muted-foreground text-[10px] block mb-0.5">Net Change (This Cycle)</span>
                    <span className={`font-semibold ${c.netChange < 0 ? 'text-orange-500' : c.netChange > 0 ? 'text-blue-500' : 'text-foreground'}`}>
                      {c.netChange > 0 ? '+' : ''}{formatSensitive(c.netChange)}
                    </span>
                    {pendingDeductionsByCategory[c.name] > 0 && (
                      <span className="text-[10px] text-yellow-500 block font-normal">
                        (-{formatSensitive(pendingDeductionsByCategory[c.name])})
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[10px] block mb-0.5">Remaining Balance</span>
                    <span className={`font-bold ${isNeg ? 'text-orange-500' : 'text-foreground'}`}>
                      {formatSensitive(c.remaining)}
                    </span>
                    {pendingDeductionsByCategory[c.name] > 0 && (
                      <span className={`text-[10px] block font-semibold ${(c.remaining - pendingDeductionsByCategory[c.name]) < 0 ? 'text-orange-500' : 'text-yellow-500'}`}>
                        ({formatSensitive(c.remaining - pendingDeductionsByCategory[c.name])})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid of Metric Cards (Now 3 columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Balance (Liquid Only) */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs hover:border-blue-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Liquid Net Worth</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {formatSensitive(stats.totalBalance)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-start gap-1">
            <AlertCircle className="size-3 text-blue-500 shrink-0 mt-0.5" />
            <span>Growth (long-term savings) is excluded.</span>
          </p>
        </div>

        {/* Inflow Card (Arrow points up/right, green) */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs hover:border-blue-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Cycle Inflow</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {formatSensitive(stats.monthlyInflow)}
          </div>
          <p className="text-[10px] mt-1.5 text-muted-foreground">
            Total Actual Income: <span className="font-semibold text-blue-500">{formatSensitive(stats.monthlyIncome)}</span>
          </p>
        </div>

        {/* Expenses Card (Arrow points down/left, red) */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs hover:border-orange-500/30 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Cycle Outflow</span>
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform duration-300">
              <ArrowDownLeft className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {formatSensitive(stats.monthlyExpenses)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Active committed bills: <span className="font-semibold text-orange-500">{formatSensitive(stats.activeRecurringTotal)}</span>/mo
          </p>
        </div>
      </div>

      {/* Dynamic Excel Target Metric Cards */}
      <div className="p-6 bg-card border border-border/60 rounded-2xl shadow-xs">
        <h3 className="text-md font-bold text-foreground mb-1">Financial Plan Metrics</h3>
        <p className="text-xs text-muted-foreground mb-4">Target ratios evaluated using calculations mapped directly from spreadsheet cells.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Growth Achieved */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Growth Achieved</span>
              <span className="text-foreground">{(stats.growthPercentAchieved * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-violet-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.max(0, Math.min(100, stats.growthPercentAchieved * 100))}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block leading-relaxed">
              Plan Target: Deposit <strong>{(activeSettings.growthAlloc * 100).toFixed(0)}%</strong> of income ({formatSensitive(categories.find(c => c.name === "Growth")?.target || 1000)}) into savings this cycle.
            </span>
          </div>

          {/* Essentials Remaining */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Essentials Remaining</span>
              <span className="text-foreground">{(stats.essentialsPercentRemaining * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${stats.essentialsPercentRemaining > 0.5 ? 'bg-sky-500' : stats.essentialsPercentRemaining > 0.2 ? 'bg-yellow-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, stats.essentialsPercentRemaining * 100))}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block leading-relaxed">
              Starts at 100% of cycle target ({formatSensitive(categories.find(c => c.name === "Essentials")?.target || 0)}). Decreases with each essentials spend.
            </span>
          </div>

          {/* Stability Reached */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/40">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Stability Cap Reached</span>
              <span className="text-foreground">{(stats.stabilityPercentReached * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="bg-teal-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.max(0, Math.min(100, stats.stabilityPercentReached * 100))}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground block leading-relaxed">
              Target Stability Fund goal is <strong>{formatSensitive(activeSettings.targetStabilityFund)}</strong>. Currently at {formatSensitive(categories.find(c => c.name === "Stability")?.remaining || 0)}.
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Balance Trend Line */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-md font-semibold text-foreground">Total Growth Deposited</h3>
                <p className="text-[10px] text-muted-foreground">Cumulative Growth category investment balance</p>
              </div>
              <TrendLineIcon className="size-4 text-blue-500 shrink-0" />
            </div>
            {/* Period Toggle */}
            <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-[9px] mb-3 w-fit">
              {(['3month', '6month', 'yearly'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTrendView(v)}
                  className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                    trendView === v ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === '3month' ? '3M' : v === '6month' ? '6M' : 'Year'}
                </button>
              ))}
            </div>

            {/* SVG Line Chart */}
            <div className={`h-40 flex items-end justify-center w-full relative mt-2 transition-all duration-300 ${hideSensitive ? 'blur-xs select-none pointer-events-none' : ''}`}>
              {trendLinePoints ? (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--color-primary, #3b82f6)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Fill Area */}
                  <path
                    d={`M 15,105 L ${trendLinePoints} L 485,105 Z`}
                    fill="url(#chartGradient)"
                    className="transition-all duration-300"
                  />
                  
                  {/* Stroke Line */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    points={trendLinePoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />

                  {/* Month labels on X axis */}
                  {activeTrendPoints.length >= 2 && activeTrendPoints.map((p, i) => {
                    const x = 15 + (i / (activeTrendPoints.length - 1)) * 470
                    return (
                      <text key={i} x={x} y={118} textAnchor="middle" fontSize="9" fill="currentColor" className="text-muted-foreground opacity-60">
                        {p.month}
                      </text>
                    )
                  })}
                </svg>
              ) : (
                <div className="text-xs text-muted-foreground pb-12">Calculating trend points...</div>
              )}
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-3 mt-3 flex justify-between text-[10px] text-muted-foreground select-none">
            <span>{trendView === '3month' ? 'Last 3 cycles' : trendView === '6month' ? 'Last 6 cycles' : `${activeSettings.selectedYear} full year`}</span>
            <span>Growth Savings: {formatSensitive(categories.find(c => c.name === 'Growth')?.remaining ?? 0)}</span>
          </div>
        </div>

        {/* Category Expenditures Doughnut Chart */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 gap-2">
              <div>
                <h3 className="text-md font-semibold text-foreground">Outflow Categories</h3>
                <p className="text-[10px] text-muted-foreground">Expense breakdown by category</p>
              </div>
              <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 text-[9px] shrink-0">
                {(['monthly', '3month', '6month', 'yearly'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      chartView === v ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v === 'monthly' ? '1M' : v === '3month' ? '3M' : v === '6month' ? '6M' : 'Year'}
                  </button>
                ))}
              </div>
            </div>

            {totalBreakdownAmount > 0 ? (
              <div className="flex flex-col items-center gap-4 mt-2">
                {/* SVG Doughnut Chart */}
                <div className="relative size-28 shrink-0">
                  <svg className="size-full overflow-visible" viewBox="0 0 200 200">
                    {slices.map((slice, index) => {
                      const isHovered = hoveredSlice === index
                      const pathD = getDoughnutPath(
                        100,
                        100,
                        isHovered ? 86 : 80,
                        isHovered ? 46 : 52,
                        slice.startAngle,
                        slice.endAngle
                      )
                      return (
                        <path
                          key={slice.category}
                          d={pathD}
                          fill={getCategoryColor(slice.category)}
                          className="transition-all duration-200 cursor-pointer stroke-card stroke-2 hover:opacity-90"
                          onMouseEnter={() => setHoveredSlice(index)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        />
                      )
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center p-2">
                    {hoveredSlice !== null ? (
                      <>
                        <span className="text-[8px] text-muted-foreground font-bold truncate max-w-[70px] uppercase">
                          {slices[hoveredSlice].category}
                        </span>
                        <span className="text-xs font-black text-foreground">
                          {(slices[hoveredSlice].percentage * 100).toFixed(0)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[8px] text-muted-foreground font-bold uppercase">
                          Total
                        </span>
                        <span className="text-[10px] font-black text-foreground truncate max-w-[75px]">
                          {formatSensitive(totalBreakdownAmount)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend List */}
                <div className="w-full space-y-1 max-h-24 overflow-y-auto pr-1">
                  {slices.map((slice, index) => (
                    <div
                      key={slice.category}
                      className={`flex items-center justify-between text-[10px] py-0.5 px-1.5 rounded-md transition-colors duration-150 ${
                        hoveredSlice === index ? 'bg-muted/50' : ''
                      }`}
                      onMouseEnter={() => setHoveredSlice(index)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    >
                      <div className="flex items-center gap-1.5 truncate mr-2">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: getCategoryColor(slice.category) }}
                        />
                        <span className="font-semibold text-foreground truncate max-w-[65px]">
                          {slice.category}
                        </span>
                      </div>
                      <span className="text-muted-foreground font-medium shrink-0">
                        {formatSensitive(slice.amount)} ({(slice.percentage * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center p-4">
                <span className="text-[10px] text-muted-foreground">No outflows logged.</span>
              </div>
            )}
          </div>
          <div className="border-t border-border/50 pt-3 mt-3 text-[10px] text-muted-foreground text-center">
            {chartView === 'monthly' ? 'Selected Cycle Outflow Share'
              : chartView === '3month' ? 'Last 3 Cycles Outflow Share'
              : chartView === '6month' ? 'Last 6 Cycles Outflow Share'
              : `Full ${activeSettings.selectedYear} Outflow Share`}
          </div>
        </div>

        {/* Active Month Recurring Payments Timeline */}
        <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-md font-semibold text-foreground">Subscriptions</h3>
                <p className="text-[10px] text-muted-foreground">Bills for this active cycle</p>
              </div>
              <Calendar className="size-4 text-blue-500 shrink-0" />
            </div>

            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-1">
              {activeRecurring.map((rp: any) => (
                <div key={rp.id} className="flex items-center justify-between text-[11px] py-1.5 border-b border-border/30 last:border-b-0">
                  <div className="truncate mr-2">
                    <span className="font-semibold text-foreground truncate block max-w-[100px]">{rp.name}</span>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 select-none">
                      <span className={`inline-block text-[8px] px-1.5 py-0.25 font-semibold rounded border ${categoryColorMap[rp.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                        {rp.category}
                      </span>
                      {rp.isPaid ? (
                        <span className="text-[8px] px-1.5 py-0.25 font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded">
                          Paid
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.25 font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-orange-500 font-bold block">-{formatSensitive(rp.amount)}</span>
                    <div className="flex items-center gap-1.5">
                      {!rp.isPaid && rp.dueDate <= todayStr && (
                        <button
                          onClick={() => {
                            const pDate = prompt("Enter paid date (yyyy-MM-dd):", rp.dueDate)
                            if (pDate) {
                              onConfirmSubscription(rp, pDate)
                            }
                          }}
                          className="text-[9px] font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/25 hover:scale-[1.02] active:scale-95 px-1.5 py-0.5 rounded border border-blue-500/20 cursor-pointer transition"
                        >
                          Confirm
                        </button>
                      )}
                      <span className="text-muted-foreground text-[9px]">Due {rp.dueDate}</span>
                    </div>
                  </div>
                </div>
              ))}
              {activeRecurring.length === 0 && (
                <div className="text-xs text-muted-foreground py-10 text-center">No subscriptions for this cycle.</div>
              )}
            </div>
          </div>

          <button 
            onClick={() => onNavigate('recurring')}
            className="w-full py-2 mt-4 text-center text-xs font-semibold text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 rounded-xl transition duration-200 cursor-pointer"
          >
            Manage Subscriptions
          </button>
        </div>
      </div>

      {/* Month Transactions List */}
      <div className="p-6 rounded-2xl bg-card border border-border/60 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Manual Inflows & Outflows</h3>
            <p className="text-xs text-muted-foreground">Manual postings logged in this active cycle range</p>
          </div>
          <button 
            onClick={() => onNavigate('ledger')}
            className="text-xs text-blue-500 font-semibold hover:underline cursor-pointer"
          >
            View Ledger
          </button>
        </div>

        <div className="divide-y divide-border/40">
          {recentTransactions.map((t: any) => {
            const isOutflow = t.amount < 0
            return (
              <div key={t.id} className="py-3 flex items-center justify-between hover:bg-muted/30 px-2 rounded-lg transition duration-150">
                <div className="flex items-center gap-3">
                  {/* Corrected arrows: isOutflow gets ArrowDownLeft (red), isInflow gets ArrowUpRight (green) */}
                  <div className={`p-2 rounded-lg ${isOutflow ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    {isOutflow ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{t.description}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{t.date}</span>
                      <span>•</span>
                      <span>{t.ledgerCategory}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${isOutflow ? 'text-foreground' : 'text-blue-500'}`}>
                    {isOutflow ? '-' : '+'}{formatSensitive(Math.abs(t.amount))}
                  </div>
                  <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.25 font-bold rounded border ${categoryColorMap[t.category] || 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                    {t.category}
                  </span>
                </div>
              </div>
            )
          })}
          {recentTransactions.length === 0 && (
            <div className="text-xs text-muted-foreground py-12 text-center">No manual ledger entries found for this cycle.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function GetDayWithSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
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

  const getSuffix = (d: number) => {
    if (d >= 11 && d <= 13) return `${d}th`
    switch (d % 10) {
      case 1: return `${d}st`
      case 2: return `${d}nd`
      case 3: return `${d}rd`
      default: return `${d}th`
    }
  }

  if (cycleDay === 1) {
    const days = new Date(year, monthIdx + 1, 0).getDate()
    return `${month} 1st ~ ${month} ${getSuffix(days)}`
  }

  const startDayActual = Math.min(cycleDay, new Date(year, monthIdx + 1, 0).getDate())
  const startDate = new Date(year, monthIdx, startDayActual)
  const endDate = new Date(startDate)
  endDate.setMonth(endDate.getMonth() + 1)
  endDate.setDate(endDate.getDate() - 1)

  const startMonthStr = months[startDate.getMonth()]
  const endMonthStr = months[endDate.getMonth()]

  return `${startMonthStr} ${getSuffix(startDate.getDate())} ~ ${endMonthStr} ${getSuffix(endDate.getDate())}`
}

function getDoughnutPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startAngleRad = ((startAngleDeg - 90) * Math.PI) / 180
  const endAngleRad = ((endAngleDeg - 90) * Math.PI) / 180

  const x1_outer = cx + rOuter * Math.cos(startAngleRad)
  const y1_outer = cy + rOuter * Math.sin(startAngleRad)
  const x2_outer = cx + rOuter * Math.cos(endAngleRad)
  const y2_outer = cy + rOuter * Math.sin(endAngleRad)

  const x1_inner = cx + rInner * Math.cos(startAngleRad)
  const y1_inner = cy + rInner * Math.sin(startAngleRad)
  const x2_inner = cx + rInner * Math.cos(endAngleRad)
  const y2_inner = cy + rInner * Math.sin(endAngleRad)

  const largeArcFlag = endAngleDeg - startAngleDeg > 180 ? 1 : 0

  return `
    M ${x1_outer} ${y1_outer}
    A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2_outer} ${y2_outer}
    L ${x2_inner} ${y2_inner}
    A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1_inner} ${y1_inner}
    Z
  `
}
