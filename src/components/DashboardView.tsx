import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { listContainerVariants, listItemVariants, listItemExit } from '../lib/animations'
import { Button } from './ui/Button'
import type { Transaction, DashboardData, WishlistItem, PendingNotification, CategorySummary, ActiveRecurringPayment } from '../types'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  AlertCircle,
  PiggyBank,
  Eye,
  EyeOff
} from 'lucide-react'
import { CustomSelect } from './ui/CustomSelect'
import { DatePicker } from './ui/DatePicker'
import { CustomConfirmModal } from './ui/CustomConfirmModal'
import { SwipeableRow } from './ui/SwipeableRow'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/Skeleton'
import { formatCurrencyVal, getCurrencySymbol, maskCurrencyInput, SENSITIVE_AMOUNT_MASK } from '../lib/utils'
import { getCategoryBadgeClass } from '../lib/categoryColors'
import { getCycleLabelForDropdown, ordinal } from '../lib/cycleLabels'
import { getActiveWishlistItem } from '../lib/wishlist'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { SmartAmountInput } from './ui/SmartAmountInput'
import { useAppContext } from '../contexts/AppContext'
import { CycleCalendar } from './dashboard/CycleCalendar'
import { TrendLineChart } from './dashboard/TrendLineChart'
import { DoughnutChart } from './dashboard/DoughnutChart'
import { CarryoverLedgerTable } from './dashboard/CarryoverLedgerTable'

interface DashboardViewProps {
  dashboardData: DashboardData | null
  transactions: Transaction[]
  onSelectPeriod: (month: string, year: number) => void
  onNavigate: (tab: 'dashboard' | 'recurring' | 'ledger' | 'wishlist' | 'settings') => void
  hideSensitive?: boolean
  hideBalanceAmounts: boolean
  walletBalance: number
  onToggleBalanceAmounts: () => void
  onConfirmSubscription: (noti: PendingNotification, paidDate: string) => void
  onDeletePayment: (id: string) => void
  onNavigateToLedger?: (options: { 
    category?: string | null; 
    date?: string | null; 
    txType?: 'inflow' | 'outflow' | null; 
    range?: 'monthly' | '3month' | '6month' | 'yearly';
    highlightedTxId?: string | null;
    showAllCycles?: boolean;
  }) => void
  wishlist?: WishlistItem[]
  onDiscardSubscription?: (noti: PendingNotification) => void
  onAddTransaction?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  onAddBalanceAdjustment?: (newTx: Omit<Transaction, 'id'>) => Promise<void> | void
  isSwitchingCycle?: boolean
}
export const DashboardView: React.FC<DashboardViewProps> = ({ 
  dashboardData,
  transactions,
  onSelectPeriod,
  onNavigate,
  hideSensitive: hideSensitiveProp,
  hideBalanceAmounts,
  walletBalance,
  onToggleBalanceAmounts,
  onConfirmSubscription,
  onDeletePayment,
  onNavigateToLedger,
  wishlist = [],
  onDiscardSubscription,
  onAddBalanceAdjustment,
  isSwitchingCycle = false
}) => {
  const { hideSensitive: contextHideSensitive } = useAppContext()
  const hideSensitive = hideSensitiveProp ?? contextHideSensitive
  const [notiToDelete, setNotiToDelete] = useState<PendingNotification | null>(null)

  // Active wishlist item for dashboard progress display
  const activeWishlistItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])
  
  // Balance adjustment modal state
  const [adjustingCategory, setAdjustingCategory] = useState<CategorySummary | null>(null)
  const [newBalanceInput, setNewBalanceInput] = useState<string>('')
  const [balanceErrors, setBalanceErrors] = useState<Record<string, string>>({})
  const [adjustmentDescription, setAdjustmentDescription] = useState<string>('Balance Adjustment')
  const [pendingBalanceAdjustment, setPendingBalanceAdjustment] = useState<{
    transaction: Omit<Transaction, 'id'>
    categoryName: string
    currentBalance: number
    targetBalance: number
    diff: number
  } | null>(null)

  // Subscription Confirmation States
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null)
  const [paidDateInput, setPaidDateInput] = useState('')

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years = useMemo<number[]>(() => {
    return dashboardData?.availableYears || [new Date().getFullYear()]
  }, [dashboardData])

  // Extract variables from dashboardData or fall back to defaults
  const activeSettings = dashboardData?.setting || {
    targetStabilityFund: 10000.00,
    selectedMonth: 'Jun',
    selectedYear: 2026,
    essentialsAlloc: 0.50,
    growthAlloc: 0.25,
    stabilityAlloc: 0.15,
    rewardsAlloc: 0.10,
    cycleDay: 28,
    currency: 'USD'
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
    monthlyIncome: 0.00,
    monthlyInflow: 0.00,
    monthlyExpenses: 0.00,
    activeRecurringTotal: 29.50,
    growthPercentAchieved: 0.0,
    stabilityPercentReached: 0.2436
  }


  const activeRecurring = dashboardData?.activeRecurringPayments || []
  const areBalanceAmountsMasked = hideSensitive || hideBalanceAmounts

  const pendingDeductionsByCategory = useMemo(() => {
    const sums: Record<string, number> = {
      'Essentials': 0,
      'Growth': 0,
      'Stability': 0,
      'Rewards': 0
    }
    const rpList = dashboardData?.activeRecurringPayments
    if (rpList) {
      rpList.forEach((rp: ActiveRecurringPayment) => {
        // Only a bill still awaiting action should be projected as an upcoming deduction --
        // isPaid alone is false for both "not yet paid" and "discarded", and a discarded bill
        // isn't coming out of the budget, so status is the only field that distinguishes them.
        if (rp.status === 'Pending') {
          const cat = rp.ledgerCategory || rp.category
          if (cat && sums[cat] !== undefined) {
            sums[cat] += Math.abs(rp.amount)
          }
        }
      })
    }
    return sums
  }, [dashboardData?.activeRecurringPayments])

  // Format currency
  const formatCurrency = (val: number) => {
    return formatCurrencyVal(val, activeSettings.currency || 'USD')
  }

  const formatSensitive = (val: number) => {
    return hideSensitive ? (
      <span
        title="Sensitive data masked (Privacy Mode active)"
        className="inline-block font-mono font-semibold tracking-wide text-foreground select-none"
      >
        {SENSITIVE_AMOUNT_MASK}
      </span>
    ) : (
      <span className="transition-[filter] duration-200">{formatCurrency(val)}</span>
    )
  }

  const formatCompactNetValue = (val: number) => {
    const abs = Math.abs(Math.round(val))
    const symbol = getCurrencySymbol(activeSettings.currency || 'USD')
    if (abs >= 1000000) {
      return `${val < 0 ? '-' : '+'}${symbol}${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}M`
    }
    if (abs >= 1000) {
      return `${val < 0 ? '-' : '+'}${symbol}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
    }
    return `${val < 0 ? '-' : '+'}${symbol}${abs}`
  }

  const formatCompactSensitive = (val: number) => {
    return hideSensitive ? (
      <span
        title="Sensitive data masked (Privacy Mode active)"
        className="inline-block font-mono font-semibold tracking-wide text-foreground select-none"
      >
        {SENSITIVE_AMOUNT_MASK}
      </span>
    ) : (
      <span className="transition-[filter] duration-200">{formatCompactNetValue(val)}</span>
    )
  }

  const openBalanceAdjustment = (category: CategorySummary) => {
    if (hideSensitive) return
    setAdjustingCategory(category)
    setNewBalanceInput(category.remaining.toFixed(2))
    setAdjustmentDescription('Balance Adjustment')
    setBalanceErrors({})
  }

  const handleCloseAdjustBalance = () => {
    setAdjustingCategory(null)
    setNewBalanceInput('')
    setAdjustmentDescription('')
    setBalanceErrors({})
  }

  const prepareBalanceAdjustment = () => {
    if (!adjustingCategory) return
    
    const targetVal = parseFloat(newBalanceInput)
    const newErrors: Record<string, string> = {}
    if (isNaN(targetVal)) {
      newErrors.balance = 'Please enter a valid balance amount.'
    }
    if (!adjustmentDescription.trim()) {
      newErrors.description = 'Description is required.'
    }

    if (Object.keys(newErrors).length > 0) {
      setBalanceErrors(newErrors)
      return
    }
    setBalanceErrors({})

    const diff = targetVal - adjustingCategory.remaining
    if (Math.abs(diff) < 0.005) {
      setAdjustingCategory(null)
      return
    }

    const now = new Date()
    const y = now.getFullYear()
    const mo = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${d}`

    setPendingBalanceAdjustment({
      transaction: {
        description: adjustmentDescription.trim() || 'Balance Adjustment',
        amount: diff,
        category: 'Adjustment',
        ledgerCategory: adjustingCategory.name,
        date: dateStr
      },
      categoryName: adjustingCategory.name,
      currentBalance: adjustingCategory.remaining,
      targetBalance: targetVal,
      diff
    })
    setAdjustingCategory(null)
  }

  if (isSwitchingCycle) {
    return <CycleSkeleton variant="dashboard" />
  }

  return (
    <div className="space-y-6 soft-rise">
      
      {/* Period Selection & Header */}
      <div className="app-panel relative z-40 overflow-visible rounded-2xl border border-blue-500/15 bg-card/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-4 sm:p-6 rounded-2xl bg-linear-to-br from-blue-500/10 via-transparent to-teal-500/10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/15">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Ledger Dashboard
              </h2>
              <p className="text-muted-foreground text-xs mt-0.5 truncate">
                Active Cycle: <span className="font-semibold text-blue-500">{cycleLabel}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 lg:max-w-2xl">
            <div className="flex flex-col gap-3 rounded-xl border border-blue-500/15 bg-background/55 px-3.5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-blue-500">Wallet Balance</span>
                  <span className="rounded-md border border-border/50 bg-card/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Essentials + Stability + Rewards
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Growth savings are excluded from this spendable balance.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                <div className="text-left sm:text-right">
                  <div className="text-xl font-black text-foreground">
                    {areBalanceAmountsMasked ? (
                      <span className="font-mono tracking-wide">{SENSITIVE_AMOUNT_MASK}</span>
                    ) : (
                      <AnimatedNumber value={walletBalance} formatFn={formatCurrency} />
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                    {hideSensitive ? 'Sensitive mode active' : hideBalanceAmounts ? 'Hidden on this device' : 'Visible'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleBalanceAmounts}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-card/80 text-muted-foreground transition hover:border-blue-500/35 hover:bg-blue-500/10 hover:text-blue-500 cursor-pointer"
                  title={hideBalanceAmounts ? 'Show wallet and carryover balances' : 'Hide wallet and carryover balances'}
                  aria-label={hideBalanceAmounts ? 'Show wallet and carryover balances' : 'Hide wallet and carryover balances'}
                >
                  {hideBalanceAmounts ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Calendar className="size-3.5 text-teal-500" />
              <span>Cycle starts on the</span>
              <span className="font-bold text-foreground">{ordinal(activeSettings.cycleDay)}</span>
            </div>
          </div>
        </div>
        
        <div className="relative z-50 grid grid-cols-[minmax(0,1fr)_5.5rem] sm:grid-cols-[minmax(14rem,1fr)_7rem] gap-2 w-full lg:w-auto lg:min-w-[22rem]">
          {/* Month Selector */}
          <CustomSelect 
            value={activeSettings.selectedMonth}
            onChange={(val) => onSelectPeriod(val, activeSettings.selectedYear)}
            options={months.map(m => ({
              value: m,
              label: getCycleLabelForDropdown(m, activeSettings.selectedYear, activeSettings.cycleDay)
            }))}
            className="w-full"
          />

          {/* Year Selector */}
          <CustomSelect 
            value={activeSettings.selectedYear}
            onChange={(val) => onSelectPeriod(activeSettings.selectedMonth, Number(val))}
            options={years.map(y => ({
              value: y,
              label: y.toString()
            }))}
            className="w-full"
            align="right"
          />
        </div>
        </div>
      </div>

      {/* Pending Subscriptions Notifications Alert */}
      {dashboardData?.pendingNotifications && dashboardData.pendingNotifications.length > 0 && (
        <div className="app-panel p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5 mb-2.5">
            <AlertCircle className="size-5 shrink-0 text-yellow-500" />
            <h4 className="text-sm font-bold text-foreground">Pending Subscription Confirmations</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            You have {dashboardData.pendingNotifications.length} subscription billing cycle{dashboardData.pendingNotifications.length > 1 ? 's' : ''} awaiting confirmation.
          </p>
          <motion.div
            initial="hidden" animate="show"
            variants={listContainerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
          >
            <AnimatePresence>
            {dashboardData.pendingNotifications.map((noti) => {
              const isConfirming = activeConfirmId === noti.id
              const notificationBody = (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-xs truncate block">{noti.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border ${getCategoryBadgeClass(noti.category)}`}>
                        {noti.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{noti.billingDate}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-orange-500 font-extrabold text-xs block">
                      -{formatSensitive(noti.amount)}
                    </span>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">{noti.cycleLabel}</span>
                  </div>
                </div>
              )
              const startConfirm = () => {
                setActiveConfirmId(noti.id)
                setPaidDateInput(noti.billingDate)
              }
              const dashboardActions = (
                <>
                  <button
                    onClick={startConfirm}
                    className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[10px] font-extrabold transition cursor-pointer"
                  >
                    Pay
                  </button>
                  {onDiscardSubscription && (
                    <button
                      onClick={() => onDiscardSubscription(noti)}
                      className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-[10px] font-extrabold transition cursor-pointer"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => setNotiToDelete(noti)}
                    className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[10px] font-extrabold transition cursor-pointer"
                  >
                    Remove
                  </button>
                </>
              )
              const dashboardDesktopActions = (
                <>
                  <button
                    onClick={startConfirm}
                    className="px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[10px] rounded-lg transition duration-150 cursor-pointer text-center whitespace-nowrap"
                  >
                    Pay
                  </button>
                  {onDiscardSubscription && (
                    <button
                      onClick={() => onDiscardSubscription(noti)}
                      className="px-2.5 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-[10px] rounded-lg transition duration-150 cursor-pointer text-center whitespace-nowrap"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => setNotiToDelete(noti)}
                    className="px-2.5 py-1.5 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[10px] rounded-lg transition duration-150 cursor-pointer border border-orange-500/10 text-center whitespace-nowrap"
                  >
                    Remove
                  </button>
                </>
              )
              return (
                <motion.div
                  key={noti.id}
                  variants={listItemVariants}
                  exit={listItemExit}
                  className={isConfirming ? "p-3.5 rounded-xl bg-card border border-border/40 shadow-xs flex flex-col justify-between gap-3" : "rounded-xl"}
                >
                  {isConfirming ? (
                    <div className="flex flex-col gap-2 p-2 bg-muted/30 border border-border/40 rounded-lg animate-in slide-in-from-bottom-2 duration-200">
                      {notificationBody}
                      <label className="text-[10px] font-bold text-muted-foreground">Select Paid Date:</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <DatePicker
                          value={paidDateInput}
                          onChange={setPaidDateInput}
                          className="w-full sm:flex-1"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => {
                              onConfirmSubscription(noti, paidDateInput)
                              setActiveConfirmId(null)
                            }}
                            className="flex-1 sm:flex-initial text-xs"
                          >
                            Confirm
                          </Button>
                          <button
                            onClick={() => setActiveConfirmId(null)}
                            className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold cursor-pointer transition border border-border text-center"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <SwipeableRow
                      className="rounded-xl border border-border/40 bg-card"
                      contentClassName="p-3.5"
                      actionsWidth={168}
                      actions={dashboardActions}
                      desktopActions={dashboardDesktopActions}
                    >
                      {notificationBody}
                    </SwipeableRow>
                  )}
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <CustomConfirmModal
        isOpen={!!notiToDelete}
        title="Remove Subscription"
        message="Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (notiToDelete) {
            onDeletePayment(notiToDelete.recurringPaymentId)
            setNotiToDelete(null)
          }
        }}
        onCancel={() => setNotiToDelete(null)}
      />

      <CarryoverLedgerTable
        categories={categories}
        pendingDeductionsByCategory={pendingDeductionsByCategory}
        amountsMasked={areBalanceAmountsMasked}
        hideSensitive={hideSensitive}
        formatCurrency={formatCurrency}
        onAdjust={openBalanceAdjustment}
      />

      {/* Financial Plan Metric Cards */}
      <div className="app-panel p-6 bg-card/92 border border-border/60 rounded-2xl">
        <h3 className="text-base font-bold text-foreground mb-1">Financial Plan Metrics</h3>
        <p className="text-xs text-muted-foreground mb-1">Cycle-wide constraint evaluation across allocation categories and targets.</p>
        {/* Legend -- protan-safe: blue (current) + orange (pending) */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-blue-500" />
            <span className="text-[10px] text-muted-foreground">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-orange-500" />
            <span className="text-[10px] text-muted-foreground">Pending deduction</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Growth Achieved */}
          {(() => {
            const growthCat = categories.find(c => c.name === 'Growth')
            const growthTarget = growthCat?.target ?? 0
            const currentPct = growthTarget > 0 ? Math.max(0, Math.min(1, stats.growthPercentAchieved)) : 0
            const pendingGrowth = pendingDeductionsByCategory['Growth'] || 0
            const projectedRemaining = Math.max(0, (growthCat?.remaining ?? 0) - pendingGrowth)
            const atRiskPct = (pendingGrowth > 0 && growthTarget > 0) ? Math.max(0, Math.min(currentPct, pendingGrowth / growthTarget)) : 0
            const safePct = currentPct - atRiskPct
            return (
              <div 
                onClick={() => onNavigateToLedger?.({ category: 'Growth', showAllCycles: true })}
                className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-violet-500/40 shadow-xs hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                    Growth Achieved
                  </span>
                  <span className="text-foreground">
                    {(currentPct * 100).toFixed(1)}%
                    {pendingGrowth > 0 && (
                      <span className="text-orange-500 ml-1">{'→'} {((currentPct - atRiskPct) * 100).toFixed(1)}%</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className="bg-violet-500 h-full transition-all duration-700 ease-out"
                    style={{ width: `${safePct * 100}%` }}
                  />
                  {pendingGrowth > 0 && atRiskPct > 0 && (
                    <div
                      className="bg-orange-500 h-full transition-all duration-700 ease-out"
                      style={{ width: `${atRiskPct * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground block leading-relaxed">
                  Plan Target: Deposit <strong>{(activeSettings.growthAlloc * 100).toFixed(0)}%</strong> of income ({formatSensitive(growthTarget)}) into savings this cycle.
                  {pendingGrowth > 0 && <span className="text-orange-500 font-semibold"> Projected after pending: {formatSensitive(projectedRemaining)}</span>}
                </span>
              </div>
            )
          })()}

          {/* Essentials Remaining */}
          {(() => {
            const essentialsCat = categories.find(c => c.name === 'Essentials')
            const essTotalAvailable = (essentialsCat?.budget ?? 0) + (essentialsCat?.target ?? 0)
            const currentPct = essTotalAvailable > 0 ? Math.max(0, Math.min(1, (essentialsCat?.remaining ?? 0) / essTotalAvailable)) : 0
            const pendingEss = pendingDeductionsByCategory['Essentials'] || 0
            const projectedRemaining = Math.max(0, (essentialsCat?.remaining ?? 0) - pendingEss)
            const projectedPct = (pendingEss > 0 && essTotalAvailable > 0) ? Math.max(0, Math.min(1, projectedRemaining / essTotalAvailable)) : currentPct
            const atRiskPct = pendingEss > 0 ? Math.max(0, currentPct - projectedPct) : 0
            return (
              <div 
                onClick={() => onNavigateToLedger?.({ category: 'Essentials', showAllCycles: false })}
                className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-sky-500/40 shadow-xs hover:shadow-lg hover:shadow-sky-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
                    Essentials Remaining
                  </span>
                  <span className="text-foreground">
                    {(currentPct * 100).toFixed(1)}%
                    {pendingEss > 0 && (
                      <span className="text-orange-500 ml-1">{'→'} {(projectedPct * 100).toFixed(1)}%</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className="bg-sky-500 h-full transition-all duration-700 ease-out"
                    style={{ width: `${projectedPct * 100}%` }}
                  />
                  {pendingEss > 0 && atRiskPct > 0 && (
                    <div
                      className="bg-orange-500 h-full transition-all duration-700 ease-out"
                      style={{ width: `${atRiskPct * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground block leading-relaxed">
                  Based on total available budget ({formatSensitive(essTotalAvailable)}), including cycle income and leftover balance. Decreases with each spend.
                  {pendingEss > 0 && <span className="text-orange-500 font-semibold"> Projected after pending: {formatSensitive(projectedRemaining)}</span>}
                </span>
              </div>
            )
          })()}

          {/* Stability Reached */}
          {(() => {
            const stabilityCat = categories.find(c => c.name === 'Stability')
            const stabilityTarget = activeSettings.targetStabilityFund || 1
            const currentPct = Math.max(0, Math.min(1, stats.stabilityPercentReached))
            const pendingStab = pendingDeductionsByCategory['Stability'] || 0
            const currentBalance = stabilityCat?.remaining ?? 0
            const projectedBalance = Math.max(0, currentBalance - pendingStab)
            const projectedPct = pendingStab > 0 ? Math.max(0, Math.min(1, projectedBalance / stabilityTarget)) : currentPct
            const atRiskPct = pendingStab > 0 ? Math.max(0, currentPct - projectedPct) : 0
            return (
              <div 
                onClick={() => onNavigateToLedger?.({ category: 'Stability', showAllCycles: true })}
                className="interactive-card space-y-2 p-4 rounded-xl bg-muted/30 hover:bg-muted/60 border border-border/40 hover:border-emerald-500/40 shadow-xs hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5 cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Stability Cap Reached
                  </span>
                  <span className="text-foreground">
                    {(currentPct * 100).toFixed(1)}%
                    {pendingStab > 0 && (
                      <span className="text-orange-500 ml-1">{'→'} {(projectedPct * 100).toFixed(1)}%</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-muted/80 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-700 ease-out"
                    style={{ width: `${projectedPct * 100}%` }}
                  />
                  {pendingStab > 0 && atRiskPct > 0 && (
                    <div
                      className="bg-orange-500 h-full transition-all duration-700 ease-out"
                      style={{ width: `${atRiskPct * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground block leading-relaxed">
                  Target Stability Fund goal is <strong>{formatSensitive(activeSettings.targetStabilityFund)}</strong>. Currently at {formatSensitive(currentBalance)}.
                  {pendingStab > 0 && <span className="text-orange-500 font-semibold"> Projected after pending: {formatSensitive(projectedBalance)}</span>}
                </span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Grid of Metric Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${activeWishlistItem ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
        {/* Inflow Card */}
        <div 
          onClick={() => onNavigateToLedger?.({ txType: 'inflow' })}
          className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60 hover:border-teal-500/30 transition-all duration-300 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Cycle Inflow</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500 group-hover:scale-110 transition-transform duration-300">
              <ArrowDownLeft className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyInflow} formatFn={formatCurrency} />}
          </div>
          <p className="text-[10px] mt-1.5 text-muted-foreground">
            Total Actual Income: <span className="font-semibold text-teal-500">{formatSensitive(stats.monthlyIncome)}</span>
          </p>
        </div>

        {/* Expenses Card */}
        <div 
          onClick={() => onNavigateToLedger?.({ txType: 'outflow' })}
          className="metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border border-border/60 hover:border-orange-500/30 transition-all duration-300 group cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Cycle Outflow</span>
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-transform duration-300">
              <ArrowUpRight className="size-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={stats.monthlyExpenses} formatFn={formatCurrency} />}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Active committed bills: <span className="font-semibold text-orange-500">{formatSensitive(stats.activeRecurringTotal)}</span>/mo
          </p>
        </div>

        {/* Wishlist Goal Card (Shown when active goal exists) */}
        {activeWishlistItem && (() => {
          const rewardsCategory = categories.find(c => c.name === 'Rewards')
          const rewardsBalance = rewardsCategory?.remaining ?? 0
          const pct = Math.max(0, Math.min(100, (rewardsBalance / activeWishlistItem.price) * 100))
          const canAfford = rewardsBalance >= activeWishlistItem.price

          return (
            <div 
              onClick={() => onNavigate('wishlist')}
              className={`metric-card interactive-card app-panel p-6 rounded-2xl bg-card/92 border transition-all duration-300 group cursor-pointer ${
                canAfford 
                  ? 'border-blue-500/50 hover:border-blue-500/70 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10' 
                  : 'border-border/60 hover:border-blue-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground truncate max-w-[70%]">Goal: {activeWishlistItem.name}</span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform duration-300">
                  <PiggyBank className="size-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-foreground">
                <AnimatedNumber value={pct} formatFn={(val) => val.toFixed(0) + '%'} />
              </div>
              
              <div className="w-full bg-muted rounded-full h-2.5 mt-2 overflow-hidden flex">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <p className="text-[10px] text-muted-foreground mt-2 flex justify-between">
                <span>{hideSensitive ? SENSITIVE_AMOUNT_MASK : <AnimatedNumber value={rewardsBalance} formatFn={formatCurrency} />} saved</span>
                <span className="font-semibold text-foreground">{formatSensitive(activeWishlistItem.price)}</span>
              </p>
            </div>
          )
        })()}
      </div>

      {/* Main Charts & Breakdown Section (2-column layout to prevent horizontally squeezed charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <TrendLineChart
          dashboardData={dashboardData}
          growthBalance={categories.find(category => category.name === 'Growth')?.remaining ?? 0}
        />

        <DoughnutChart
          dashboardData={dashboardData}
          selectedYear={activeSettings.selectedYear}
          onNavigateToLedger={onNavigateToLedger}
        />

      </div>

      {/* Calendar & Subscriptions Section (Calendar spans 2 columns, Subscriptions timeline spans 1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2">
          <CycleCalendar
            selectedMonth={activeSettings.selectedMonth}
            selectedYear={activeSettings.selectedYear}
            cycleDay={activeSettings.cycleDay}
            cycleLabel={cycleLabel}
            transactions={transactions}
            recurringPayments={activeRecurring}
            formatNet={formatCompactSensitive}
            onSelectDate={date => onNavigateToLedger?.({ date })}
          />
        </div>

        {/* Active Month Recurring Payments Timeline (Spans 1 column) */}
        <div className="lg:col-span-1">
          <div className="app-panel p-6 rounded-2xl bg-card/92 border border-border/60 flex flex-col h-full">
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Subscriptions</h3>
                  <p className="text-[10px] text-muted-foreground">Bills for this active cycle</p>
                </div>
                <Calendar className="size-4 text-blue-500 shrink-0" />
              </div>

              <motion.div
                initial="hidden" animate="show"
                variants={listContainerVariants}
                className="space-y-2 mt-4 flex-1 overflow-y-auto pr-1 min-h-0"
              >
                <AnimatePresence>
                {activeRecurring.map((rp: ActiveRecurringPayment) => (
                  <motion.div
                    key={rp.id}
                    variants={listItemVariants}
                    exit={listItemExit}
                    className={`flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-b-0 ${rp.isDiscarded ? 'opacity-50' : ''}`}
                  >
                    <div className="truncate mr-2">
                      <span className={`font-bold text-foreground truncate block max-w-[120px] ${rp.isDiscarded ? 'line-through' : ''}`}>{rp.name}</span>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5 select-none">
                        <span className={`inline-block text-[10px] px-1.5 py-0.5 font-semibold rounded border ${getCategoryBadgeClass(rp.category)}`}>
                          {rp.category}
                        </span>
                        {rp.isDiscarded ? (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold text-slate-500 bg-slate-500/10 border border-slate-500/20 rounded">
                            Discarded
                          </span>
                        ) : rp.isPaid ? (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded">
                            Paid
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded animate-pulse">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className={`font-bold block ${rp.isDiscarded ? 'text-slate-500 line-through' : 'text-orange-500'}`}>-{formatSensitive(rp.amount)}</span>
                      <span className="text-muted-foreground text-[9px]">Due {rp.dueDate}</span>
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
                {activeRecurring.length === 0 && (
                  <div className="text-xs text-muted-foreground py-10 text-center">No subscriptions for this cycle.</div>
                )}
              </motion.div>
            </div>

            <button 
              onClick={() => onNavigate('recurring')}
              className="w-full py-2 mt-4 text-center text-xs font-semibold text-blue-500 hover:text-blue-600 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 hover:border-blue-500/20 rounded-xl transition duration-200 cursor-pointer shrink-0"
            >
              Manage Subscriptions
            </button>
          </div>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {adjustingCategory && (
        <BottomSheet
          isOpen={!!adjustingCategory}
          title={`Adjust ${adjustingCategory.name} Balance`}
          onClose={handleCloseAdjustBalance}
          maxWidthClassName="max-w-sm"
          footer={
            (() => {
              const targetVal = parseFloat(newBalanceInput);
              const isUnchanged = adjustingCategory && !isNaN(targetVal) && Math.abs(targetVal - adjustingCategory.remaining) < 0.005;
              return (
                <div className="flex gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={handleCloseAdjustBalance}
                    className="px-4 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-xl transition duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!!isUnchanged}
                    onClick={prepareBalanceAdjustment}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer shadow-md"
                  >
                    Review Adjustment
                  </button>
                </div>
              );
            })()
          }
        >
          <div className="text-xs space-y-3">
            <div>
              <span className="text-muted-foreground block mb-0.5">Current Remaining Balance:</span>
              <span className="font-bold text-foreground">{formatSensitive(adjustingCategory.remaining)}</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Target Remaining Balance</label>
              <SmartAmountInput
                type="text"
                placeholder="0.00"
                value={newBalanceInput}
                onChange={e => {
                  const val = maskCurrencyInput(e.target.value, newBalanceInput)
                  setNewBalanceInput(val)
                  if (balanceErrors.balance) {
                    setBalanceErrors(prev => ({ ...prev, balance: '' }))
                  }
                }}
                className={`w-full px-3 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  balanceErrors.balance 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
              {balanceErrors.balance && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {balanceErrors.balance}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground block">Adjustment Description</label>
              <input
                type="text"
                required
                placeholder="e.g. Ledger alignment"
                value={adjustmentDescription}
                onChange={e => {
                  setAdjustmentDescription(e.target.value)
                  if (balanceErrors.description) {
                    setBalanceErrors(prev => ({ ...prev, description: '' }))
                  }
                }}
                className={`w-full px-3 py-2 text-sm bg-background border rounded-xl focus:outline-none focus:ring-1 transition duration-200 ${
                  balanceErrors.description 
                    ? 'border-destructive focus:ring-destructive' 
                    : 'border-border focus:ring-blue-500'
                }`}
              />
              {balanceErrors.description && (
                <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                  {balanceErrors.description}
                </p>
              )}
            </div>

            {(() => {
              const parsed = parseFloat(newBalanceInput)
              if (isNaN(parsed)) return null
              const diff = parsed - adjustingCategory.remaining
              return (
                <div className="p-3 bg-muted/40 border border-border/50 rounded-xl text-[10px] text-muted-foreground select-none">
                  Calculated ledger entry: <span className={`font-bold ${diff > 0 ? 'text-blue-500' : diff < 0 ? 'text-orange-500' : ''}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                  </span>
                </div>
              )
            })()}
          </div>
        </BottomSheet>
      )}

      <CustomConfirmModal
        isOpen={!!pendingBalanceAdjustment}
        title="Confirm Balance Adjustment"
        confirmText="Record Adjustment"
        cancelText="Cancel"
        message={pendingBalanceAdjustment && (
          <div className="space-y-3">
            <p>
              This will immediately record a ledger adjustment for <span className="font-semibold text-foreground">{pendingBalanceAdjustment.categoryName}</span>.
            </p>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span>Current balance</span>
                <span className="font-bold text-foreground">{formatSensitive(pendingBalanceAdjustment.currentBalance)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Target balance</span>
                <span className="font-bold text-foreground">{formatSensitive(pendingBalanceAdjustment.targetBalance)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5">
                <span>{pendingBalanceAdjustment.diff > 0 ? 'Addition' : 'Subtraction'}</span>
                <span className={`font-extrabold ${pendingBalanceAdjustment.diff > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  {pendingBalanceAdjustment.diff > 0 ? '+' : ''}{formatSensitive(pendingBalanceAdjustment.diff)}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              This will be pushed to the server immediately and will not be added to the ledger draft queue.
            </p>
          </div>
        )}
        onCancel={() => setPendingBalanceAdjustment(null)}
        onConfirm={() => {
          if (!pendingBalanceAdjustment) return
          const tx = pendingBalanceAdjustment.transaction
          setPendingBalanceAdjustment(null)
          void onAddBalanceAdjustment?.(tx)
        }}
      />
    </div>
  )
}
