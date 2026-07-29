import React, { useMemo } from 'react'
import { m } from 'framer-motion'
import type { WishlistItem, Transaction, SavingsGoal } from '../types'
import { SwipeableRow } from './ui/SwipeableRow'
import { BottomSheet } from './ui/BottomSheet'
import { DatePicker } from './ui/DatePicker'
import { CycleSkeleton } from './ui/Skeleton'
import { Card } from './ui/Card'
import { RowSyncStatus } from './ui/RowSyncBadge'
import { MONTH_NAMES, getCycleYearAndMonthForDate } from '../lib/cycle'
import { claimedWishlistChangeSignal, selectClaimedWishlistPage } from '../lib/claimedWishlist'
import { useSyncStatus } from '../lib/useOptimisticList'
import { getActiveWishlistItem } from '../lib/wishlist'
import { Button } from './ui/Button'
import { useAppContext } from '../contexts/AppContext'
import { useWishlistForm } from './wishlist/useWishlistForm'
import { WishlistItemForm } from './wishlist/WishlistItemForm'
import { useSavingsGoalForm } from './wishlist/useSavingsGoalForm'
import { SavingsGoalForm } from './wishlist/SavingsGoalForm'
import { SavingsGoalCard } from './wishlist/SavingsGoalCard'
import { RewardsPoolBar } from './wishlist/RewardsPoolBar'
import { SavingsGoalContributeSheet, type ContributeMode } from './wishlist/SavingsGoalContributeSheet'
import { distribute, getPaceStatus, summarizePool } from '../lib/savingsGoals'
import {
  PiggyBank,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Flag,
  Target,
  Edit2,
  Trophy,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react'
import type { PagedWishlistResult } from '../lib/api'

const CLAIMED_PAGE_SIZE = 5

// Parse a transaction/purchase date into a *local* calendar Date. Both the ledger
// 'YYYY-MM-DD' date and an ISO purchasedAt begin with the date part, so read that
// directly and avoid the UTC-midnight timezone shift `new Date('YYYY-MM-DD')` causes.
const parseClaimDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

interface WishlistViewProps {
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  transactions?: Transaction[]
  rewardsBalance: number
  rewardsTarget: number
  pastThreeMonthsRewardsAverage: number
  hasRewardsHistory: boolean
  currency?: string
  hideSensitive?: boolean
  onAddItem: (item: Partial<WishlistItem>) => Promise<void> | void
  onUpdateItem: (id: number, item: WishlistItem) => Promise<void> | void
  onDeleteItem: (id: number) => Promise<void> | void
  onPurchaseItem: (id: number, customDate?: string) => Promise<void> | void
  onAddGoal: (goal: Partial<SavingsGoal>) => Promise<void> | void
  onUpdateGoal: (id: number, goal: SavingsGoal) => Promise<void> | void
  onDeleteGoal: (id: number) => Promise<void> | void
  onCompleteGoal: (id: number) => Promise<void> | void
  onContributeToGoal: (id: number, amount: number) => Promise<void> | void
  onFundGoalsForCycle: () => Promise<void> | void
  isOffline?: boolean
  formatSensitive?: (val: number) => React.ReactNode
  autoOpenAddModal?: boolean
  onResetAutoOpen?: () => void
  onNavigateToLedger?: (options: {
    category?: string | null
    date?: string | null
    txType?: 'inflow' | 'outflow' | null
    range?: 'monthly' | '3month' | '6month' | 'yearly'
    highlightedTxId?: string | null
    showAllCycles?: boolean
    targetMonth?: string
    targetYear?: number
  }) => void
  cycleDay?: number
  onFetchClaimedWishlist?: (page: number, pageSize: number) => Promise<PagedWishlistResult>
  activeSyncId?: string | null
  deletingId?: string | null
  isSwitchingCycle?: boolean
  // Signals to the parent's drain loop which item is being edited, so the
  // corresponding queued op isn't dispatched while the edit modal is open.
  onStartEditPending?: (id: string | null) => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  savingsGoals,
  transactions,
  rewardsBalance,
  rewardsTarget,
  pastThreeMonthsRewardsAverage,
  hasRewardsHistory,
  currency: currencyProp,
  hideSensitive: hideSensitiveProp,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onPurchaseItem,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onCompleteGoal,
  onContributeToGoal,
  onFundGoalsForCycle,
  isOffline = false,
  formatSensitive: formatSensitiveProp,
  autoOpenAddModal,
  onResetAutoOpen,
  onNavigateToLedger,
  cycleDay = 28,
  onFetchClaimedWishlist,
  activeSyncId: activeSyncIdProp,
  deletingId: deletingIdProp,
  isSwitchingCycle = false,
  onStartEditPending,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed
}) => {
  const app = useAppContext()
  const currency = currencyProp ?? app.currency
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const formatSensitive = formatSensitiveProp ?? app.formatSensitive
  const activeSyncId = activeSyncIdProp ?? app.activeSyncId
  const deletingId = deletingIdProp ?? app.deletingId
  const { isSyncing: isItemSyncing, isDeleting: isItemDeleting } = useSyncStatus(wishlist, activeSyncId, deletingId)

  const [purchasingItem, setPurchasingItem] = React.useState<WishlistItem | null>(null)
  const [purchaseDateInput, setPurchaseDateInput] = React.useState<string>(new Date().toLocaleDateString('en-CA'))

  const handleOpenClaimModal = (item: WishlistItem) => {
    setPurchaseDateInput(new Date().toLocaleDateString('en-CA'))
    setPurchasingItem(item)
  }

  const handleConfirmPurchase = () => {
    if (!purchasingItem) return
    void onPurchaseItem(purchasingItem.id, purchaseDateInput)
    setPurchasingItem(null)
  }

  // Open a claimed reward's ledger entry: jump to the cycle that owns the purchase
  // date (which may be a previous cycle) in monthly view, then highlight/scroll to
  // the transaction. Monthly view is used because the ledger's highlight searches
  // the loaded single-cycle list — all-cycles mode is server-paged and can't find it.
  const handleOpenClaimInLedger = (txId: string, rawDate: string | null) => {
    if (!onNavigateToLedger) return
    const options: Parameters<NonNullable<typeof onNavigateToLedger>>[0] = {
      highlightedTxId: txId,
      showAllCycles: false,
      range: 'monthly',
    }
    const claimDate = rawDate ? parseClaimDate(rawDate) : null
    if (claimDate) {
      const { year, monthIndex } = getCycleYearAndMonthForDate(claimDate, cycleDay)
      options.targetMonth = MONTH_NAMES[monthIndex - 1]
      options.targetYear = year
    }
    onNavigateToLedger(options)
  }

  const {
    showAddModal,
    showEditModal,
    editingItem,
    errors,
    setErrors,
    nameInput,
    setNameInput,
    priceInput,
    priorityInput,
    setPriorityInput,
    isActiveInput,
    setIsActiveInput,
    handlePriceChange,
    handleOpenAddModal,
    handleOpenEditModal,
    closeAddModal,
    closeEditModal,
    handleSaveAdd,
    handleSaveEdit,
  } = useWishlistForm({
    wishlist,
    hideSensitive,
    autoOpenAddModal,
    onResetAutoOpen,
    onAddItem,
    onUpdateItem,
    onStartEditPending,
    aiDraft,
    aiEditDraft,
    onAiDraftConsumed,
    onAiEditDraftConsumed,
  })

  const goalForm = useSavingsGoalForm({
    goals: savingsGoals,
    hideSensitive,
    onAddGoal,
    onUpdateGoal,
    onStartEditPending,
  })

  const { isSyncing: isGoalSyncing, isDeleting: isGoalDeleting } = useSyncStatus(savingsGoals, activeSyncId, deletingId)
  const [contributeTarget, setContributeTarget] = React.useState<{ goal: SavingsGoal; mode: ContributeMode } | null>(null)

  // --- The shared pool ------------------------------------------------------------------------
  // One Rewards balance, two kinds of claim on it. Everything below is derived from this single
  // summary so the pool bar, the goal cards and the wishlist progress cannot disagree about how
  // the same money is divided.
  const today = React.useMemo(() => new Date(), [])
  const pool = useMemo(
    () => summarizePool(savingsGoals, rewardsBalance, rewardsTarget, today, cycleDay),
    [savingsGoals, rewardsBalance, rewardsTarget, today, cycleDay],
  )

  // What each goal would receive if the cycle were funded right now. Shown per card as "next
  // funding" so the tradeoff between goals is visible before the user commits to it.
  const projectedGrants = useMemo(() => {
    const waterfall = distribute(pool.activeGoals, pool.unassigned, today, cycleDay)
    return new Map(waterfall.grants.map(grant => [grant.goalId, grant.amount]))
  }, [pool.activeGoals, pool.unassigned, today, cycleDay])

  // Funding is once per cycle. Hiding the action once every goal is stamped keeps the header from
  // offering a button that would do nothing.
  const canFundThisCycle = useMemo(() => {
    if (pool.activeGoals.length === 0) return false
    const { year, monthIndex } = getCycleYearAndMonthForDate(today, cycleDay)
    const cycleKey = `${year}-${String(monthIndex).padStart(2, '0')}`
    return pool.activeGoals.some(goal => goal.lastFundedCycleKey !== cycleKey)
  }, [pool.activeGoals, today, cycleDay])

  const completedGoals = useMemo(
    () => savingsGoals.filter(goal => goal.status === 'completed'),
    [savingsGoals],
  )

  // Rewards are claimed against the FREE remainder, never the whole balance. This is the fix for
  // the page's central inaccuracy: measuring every wishlist item against `rewardsBalance` reported
  // several items as simultaneously affordable out of money that could only cover one.
  const claimableBalance = pool.unassigned

  // Rewards inflow net of what the commitments take first. This is what makes the projections
  // honest — and it is the moment the tradeoff becomes legible ("headphones are 4 months out
  // because the car fund takes 267 a cycle").
  const freeInflowPerCycle = Math.max(0, rewardsTarget - pool.requiredPerCycleTotal)
  const realisticFreeInflow = Math.max(0, pastThreeMonthsRewardsAverage - pool.requiredPerCycleTotal)

  // Separate active (hero) item and queued items
  const activeItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])

  const queuedItems = useMemo(() => {
    if (!activeItem) return wishlist.filter(w => !w.isPurchased)
    return wishlist.filter(w => !w.isPurchased && w.id !== activeItem.id)
  }, [wishlist, activeItem])

  const purchasedItems = useMemo(() => {
    return wishlist.filter(w => w.isPurchased).sort((a,b) => {
      const dateA = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0
      const dateB = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0
      if (dateB !== dateA) return dateB - dateA
      const createdA = new Date(a.createdAt).getTime()
      const createdB = new Date(b.createdAt).getTime()
      if (createdB !== createdA) return createdB - createdA
      return b.id - a.id
    })
  }, [wishlist])

  // --- Rewards Claimed history: server-side pagination (5 per page) ---------
  // The server owns paging; we fall back to client-side slicing of the cached
  // purchased items when offline / the fetch fails, so the history stays usable
  // (and shows optimistic claims) without a connection.
  const [claimPage, setClaimPage] = React.useState(1)
  const [claimServer, setClaimServer] = React.useState<PagedWishlistResult | null>(null)
  const [claimLoading, setClaimLoading] = React.useState(false)
  const [claimFailed, setClaimFailed] = React.useState(false)

  // Include sync state so completing an optimistic claim refreshes the server page.
  const purchasedSignal = claimedWishlistChangeSignal(purchasedItems)

  React.useEffect(() => {
    if (!onFetchClaimedWishlist) return
    let cancelled = false
    setClaimLoading(true)
    onFetchClaimedWishlist(claimPage, CLAIMED_PAGE_SIZE)
      .then(result => { if (!cancelled) { setClaimServer(result); setClaimFailed(false) } })
      .catch(() => { if (!cancelled) { setClaimServer(null); setClaimFailed(true) } })
      .finally(() => { if (!cancelled) setClaimLoading(false) })
    return () => { cancelled = true }
  }, [onFetchClaimedWishlist, claimPage, purchasedSignal])

  const selectedClaims = useMemo(() => selectClaimedWishlistPage(
    purchasedItems,
    claimServer,
    claimPage,
    CLAIMED_PAGE_SIZE,
    claimFailed,
  ), [purchasedItems, claimServer, claimPage, claimFailed])
  const totalClaimed = selectedClaims.total
  const claimTotalPages = Math.max(1, Math.ceil(totalClaimed / CLAIMED_PAGE_SIZE))

  // Clamp the page if deletions shrank the list below the current page.
  React.useEffect(() => {
    if (claimPage > claimTotalPages) setClaimPage(claimTotalPages)
  }, [claimPage, claimTotalPages])

  const claimPageItems = selectedClaims.items

  // How many queued rewards the FREE remainder can actually cover. Measuring against the whole
  // Rewards balance is what let this count include items the committed money could not pay for.
  const affordableCount = useMemo(() => {
    return wishlist.filter(w => !w.isPurchased && claimableBalance >= w.price).length
  }, [wishlist, claimableBalance])

  // Calculation for timeline prediction
  const getTimelineString = (itemPrice: number, rate: number) => {
    const remaining = itemPrice - claimableBalance
    if (remaining <= 0) return 'Available Now! 🎉'
    if (rate <= 0) return 'N/A'
    
    const months = remaining / rate
    const days = Math.ceil(months * 30)
    
    const today = new Date()
    const targetDate = new Date(today.setDate(today.getDate() + days))
    const formattedDate = targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    
    if (days < 30) {
      return `~${days} Days (${formattedDate})`
    }
    const roundedMonths = (days / 30).toFixed(1)
    return `~${roundedMonths} Months (${formattedDate})`
  }

  const handleToggleActive = async (item: WishlistItem) => {
    if (hideSensitive) return
    await onUpdateItem(item.id, {
      ...item,
      isActive: true
    })
  }

  return (
    <div className="space-y-6 soft-rise">
      {/* One stacked bar over one balance. rewardsBalance/rewardsTarget are cycle-scoped, so show a
          skeleton while a new cycle's dashboard data loads rather than briefly flashing the
          previous cycle's numbers. */}
      {isSwitchingCycle ? (
        <CycleSkeleton variant="wishlist" />
      ) : (
        <RewardsPoolBar
          summary={pool}
          expectedInflow={rewardsTarget}
          formatSensitive={formatSensitive}
          hideSensitive={hideSensitive}
          isOffline={isOffline}
          onFundCycle={canFundThisCycle ? () => { void onFundGoalsForCycle() } : null}
          onViewRewardsHistory={onNavigateToLedger
            ? () => onNavigateToLedger({ category: 'Rewards', showAllCycles: true })
            : undefined}
        />
      )}

      {/* Commitments vs rewards. Both columns spend the same pool, which is why they live on one
          page — separating them is how the double-counting crept in originally. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Commitments — dated obligations, all running in parallel. */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex justify-between items-center px-1">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Flag className="size-4 text-violet-500" />
                Commitments
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {pool.activeGoals.length}
                </span>
              </h3>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Things you must fund by a date</p>
            </div>
            <m.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goalForm.handleOpenAddModal}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/10 transition cursor-pointer shrink-0"
              title="Add commitment"
            >
              <Plus className="size-3.5" />
            </m.button>
          </div>

          <div className="list-container-enter space-y-3">
            {pool.activeGoals.length > 0 ? (
              pool.activeGoals.map((goal, idx) => {
                const pace = pool.paces.get(goal.id)
                if (!pace) return null
                const projectedGrant = projectedGrants.get(goal.id) ?? 0
                return (
                  <div
                    key={goal.id}
                    className="list-card-enter"
                    style={idx ? { animationDelay: `${Math.min(idx * 50, 400)}ms` } : undefined}
                  >
                    <SavingsGoalCard
                      goal={goal}
                      pace={pace}
                      status={getPaceStatus(pace, projectedGrant)}
                      projectedGrant={projectedGrant}
                      currency={currency}
                      formatSensitive={formatSensitive}
                      hideSensitive={hideSensitive}
                      isSyncing={isGoalSyncing(goal.id)}
                      isDeleting={isGoalDeleting(goal.id)}
                      onEdit={goalForm.handleOpenEditModal}
                      onDelete={onDeleteGoal}
                      onComplete={onCompleteGoal}
                      onTopUp={g => setContributeTarget({ goal: g, mode: 'topUp' })}
                      onRelease={g => setContributeTarget({ goal: g, mode: 'release' })}
                    />
                  </div>
                )
              })
            ) : (
              <Card className="p-6 border-dashed text-center">
                <Flag className="size-8 text-muted-foreground/60 mb-2 mx-auto" />
                <h4 className="font-bold text-foreground text-sm">No commitments yet</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Add something you need money ready for by a date — a car service in three months, a
                  house deposit in six years. We work out what to set aside each cycle.
                </p>
                <m.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={goalForm.handleOpenAddModal}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold shadow-md shadow-primary/10 transition cursor-pointer"
                >
                  <Plus className="size-3.5" /> Add commitment
                </m.button>
              </Card>
            )}
          </div>

          {completedGoals.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-3">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                Completed
                <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  {completedGoals.length}
                </span>
              </h4>
              <div className="space-y-1.5">
                {completedGoals.slice(0, 5).map(goal => (
                  <div key={goal.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-bold text-foreground truncate">{goal.name}</span>
                    <span className="font-semibold text-muted-foreground shrink-0">
                      {formatSensitive(goal.targetAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Rewards — serial, spontaneous, and funded only from what commitments leave behind. */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center px-1">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Target className="size-4 text-blue-500" />
                Your focus
                {affordableCount > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                    <Trophy className="size-2.5" /> {affordableCount} claimable
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                Funded from your {formatSensitive(claimableBalance)} free rewards
              </p>
            </div>
            <m.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenAddModal}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/10 transition cursor-pointer shrink-0"
              title="Add Goal"
            >
              <Plus className="size-3.5" />
            </m.button>
          </div>

          {activeItem ? (
            (() => {
              const pct = Math.max(0, Math.min(100, (claimableBalance / activeItem.price) * 100))
              const canAfford = claimableBalance >= activeItem.price

              return (
                <div 
                  className={`p-6 rounded-2xl bg-card border transition-all duration-300 flex flex-col justify-between ${
                    canAfford 
                      ? 'border-blue-500/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/10' 
                      : 'border-border/60 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header — name + status badge, mirrors subscription card top */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-base font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          {activeItem.name}
                          <RowSyncStatus isDeleting={isItemDeleting(activeItem.id)} isSyncing={isItemSyncing(activeItem.id)} isPending={activeItem.isPendingSync} entityLabel="item" />
                        </h2>
                        <span className={`inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                          activeItem.priority === 'High' 
                            ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                            : activeItem.priority === 'Medium'
                            ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                        }`}>
                          {activeItem.priority} Priority
                        </span>
                      </div>
                      {canAfford ? (
                        <span className="text-[10px] font-bold text-blue-500 flex items-center gap-1 shrink-0">
                          <PiggyBank className="size-3.5" /> Ready to Claim
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="size-3.5" /> Saving In Progress
                        </span>
                      )}
                    </div>

                    {/* Price — large figure, mirrors subscription card amount */}
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-foreground">{formatSensitive(activeItem.price)}</span>
                      <span className="text-xs text-muted-foreground">goal</span>
                    </div>

                    {/* Progress details */}
                    <div className="mt-6 space-y-2 border-t border-border/30 pt-4 text-xs">
                      <div className="flex justify-between text-xs font-bold text-muted-foreground">
                        <span>Funded</span>
                        <span className={canAfford ? 'text-blue-500' : 'text-foreground'}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                        <span>{formatSensitive(claimableBalance)} free</span>
                        <span>{formatSensitive(activeItem.price)} target</span>
                      </div>
                    </div>

                    {/* Predictor ribbon. Both rates are net of commitments: a reward is funded from
                        what the goals leave behind, so projecting off the whole Rewards budget
                        would promise a date the goals make impossible. */}
                    {!canAfford && (
                      <div className="mt-4 grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-xl border border-border/30">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-500">Optimistic Projection</span>
                          <span className="text-[11px] font-bold text-foreground block">
                            {freeInflowPerCycle > 0
                              ? getTimelineString(activeItem.price, freeInflowPerCycle)
                              : 'Not at this rate'}
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium">
                            {pool.requiredPerCycleTotal > 0 ? (
                              <>
                                Budget minus commitments (
                                {formatSensitive(freeInflowPerCycle)}
                                /mo)
                              </>
                            ) : (
                              <>
                                Based on target budget (
                                {formatSensitive(rewardsTarget)}
                                /mo)
                              </>
                            )}
                          </span>
                        </div>
                        <div className="space-y-1 border-l border-border/30 pl-3">
                          <span className="text-[10px] uppercase tracking-wider font-extrabold text-violet-500">Realistic Projection</span>
                          <span className="text-[11px] font-bold text-foreground block">
                            {hasRewardsHistory
                              ? (realisticFreeInflow > 0
                                  ? getTimelineString(activeItem.price, realisticFreeInflow)
                                  : 'Not at this rate')
                              : 'N/A'
                            }
                          </span>
                          <span className="text-[9px] text-muted-foreground block font-medium">
                            {hasRewardsHistory ? (
                              <>
                                Past 3-mo savings minus commitments (
                                {formatSensitive(realisticFreeInflow)}
                                /mo)
                              </>
                            ) : (
                              'No past savings history'
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions — matches subscription card footer style */}
                  <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between border-t border-border/30 pt-4 gap-3 sm:gap-2">
                    <m.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleOpenClaimModal(activeItem)}
                      disabled={!canAfford}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl transition duration-200 cursor-pointer w-full sm:w-auto ${
                        canAfford
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/10'
                          : 'bg-muted text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      <PiggyBank className="size-3.5" />
                      {canAfford ? 'Claim Reward' : <>Need {formatSensitive(activeItem.price - claimableBalance)} More</>}
                    </m.button>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        onClick={() => handleOpenEditModal(activeItem)}
                        disabled={hideSensitive}
                        title={hideSensitive ? 'Unhide balances to edit' : 'Edit goal'}
                        className="flex-1 sm:flex-none justify-center py-2.5"
                      >
                        <Edit2 className="size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => onDeleteItem(activeItem.id)}
                        disabled={hideSensitive}
                        title={hideSensitive ? 'Unhide balances to delete' : 'Delete goal'}
                        className="flex-1 sm:flex-none justify-center py-2.5"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <Card className="p-8 border-dashed text-center flex flex-col items-center justify-center min-h-[300px]">
              <Flag className="size-10 text-muted-foreground/60 mb-2" />
              <h4 className="font-bold text-foreground text-sm">No Active Focus Item</h4>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">Set a goal from your wishlist queue below or create a new target to track savings progress.</p>
              <m.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenAddModal}
                className="mt-4 flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold shadow-md shadow-primary/10 transition cursor-pointer"
              >
                <Plus className="size-3.5" /> Add Goal
              </m.button>
            </Card>
          )}
        </div>

        {/* Queued & Wishlist Items List */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 px-1">
            <Clock className="size-4 text-blue-500" />
            Up next <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{queuedItems.length}</span>
          </h3>

          {/* Entrance moved to CSS (.list-container-enter / .list-card-enter). Nothing in
              this list defined an `exit`, so the AnimatePresence was maintaining a
              presence context for exit animations that never ran. */}
          <div className="list-container-enter space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {queuedItems.length > 0 ? (
              queuedItems.map((item, idx) => {
                const pct = Math.max(0, Math.min(100, (claimableBalance / item.price) * 100))
                const canAfford = claimableBalance >= item.price
                const isBusy = isItemDeleting(item.id) || isItemSyncing(item.id) || item.isPendingSync

                return (
                  <div
                    className="list-card-enter"
                    style={idx ? { animationDelay: `${Math.min(idx * 50, 400)}ms` } : undefined}
                    key={item.id}
                  >
                  <SwipeableRow
                    hint={idx === 0}
                    disabled={isBusy}
                    className={`rounded-xl border shadow-xs transition duration-200 group ${
                      canAfford ? 'border-blue-500/30' : 'border-border/60 hover:border-blue-500/20'
                    }`}
                    contentClassName="p-4"
                    actionsWidth={174}
                    actions={
                      <>
                        <button
                          onClick={() => handleToggleActive(item)}
                          disabled={isBusy}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-blue-500 text-white dark:text-background text-[10px] font-bold active:bg-blue-400 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Target className="size-3.5" />
                          Focus
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          disabled={hideSensitive || isBusy}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold active:bg-primary/90 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Edit2 className="size-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          disabled={isBusy || hideSensitive}
                          className="flex-1 flex flex-col items-center justify-center gap-1 bg-orange-600 text-white text-[10px] font-bold active:bg-orange-700 transition disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </>
                    }
                    desktopActions={
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(item)}
                          disabled={isBusy || hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          Focus
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(item)}
                          disabled={hideSensitive || isBusy}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          <Edit2 className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteItem(item.id)}
                          disabled={isBusy || hideSensitive}
                          title={hideSensitive ? 'Unhide balances to edit' : undefined}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </>
                    }
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground text-xs truncate flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <RowSyncStatus isDeleting={isItemDeleting(item.id)} isSyncing={isItemSyncing(item.id)} isPending={item.isPendingSync} entityLabel="item" />
                        </h4>
                        {canAfford && (
                          <span className="size-1.5 rounded-full bg-blue-500 shrink-0" title="Ready to claim" />
                        )}
                      </div>
                      <div className="text-sm font-extrabold text-foreground">{formatSensitive(item.price)}</div>
                      <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </SwipeableRow>
                  </div>
                )
              })
            ) : (
              <div className="list-card-enter p-6 rounded-xl bg-muted/20 border border-border/40 text-center text-xs text-muted-foreground">
                No items in the wishlist queue.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Log / Purchased Items */}
      {totalClaimed > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Trophy className="size-4 text-blue-500" />
              Rewards Claimed
              {claimLoading && <Loader2 className="size-3 text-muted-foreground animate-spin" />}
            </h3>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
              {totalClaimed} {totalClaimed === 1 ? 'reward' : 'rewards'}
            </span>
          </div>
          <div className={`space-y-1.5 transition-opacity duration-150 ${claimLoading ? 'opacity-60' : ''}`}>
            {claimPageItems.map(item => {
              const linkedTx = transactions?.find(t => t.wishlistItemId === item.id || (item.purchaseTransactionId && String(t.id) === String(item.purchaseTransactionId)))
              const displayDate = linkedTx?.date || (item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : 'N/A')
              const txId = linkedTx?.id ?? (item.purchaseTransactionId ? String(item.purchaseTransactionId) : null)
              const rawDate = linkedTx?.date ?? item.purchasedAt ?? null
              const canNavigate = !!txId && !!onNavigateToLedger
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => { if (canNavigate && txId) handleOpenClaimInLedger(txId, rawDate) }}
                  aria-label={canNavigate ? `View "${item.name}" reward claim in the ledger` : undefined}
                  className={`group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors duration-150 ${
                    canNavigate
                      ? 'cursor-pointer hover:border-border/50 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring'
                      : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0 grid place-items-center size-8 rounded-lg bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/15">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-foreground block truncate">{item.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                        <Clock className="size-2.5" />
                        {displayDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="font-black text-xs text-foreground">{formatSensitive(item.price)}</span>
                      <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-500/80">Claimed</span>
                    </div>
                    {canNavigate && (
                      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {claimTotalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-border/30 pt-3">
              <button
                type="button"
                onClick={() => setClaimPage(page => Math.max(1, page - 1))}
                disabled={claimPage <= 1 || claimLoading}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="size-3.5" /> Prev
              </button>
              <span className="text-[10px] font-semibold text-muted-foreground">
                Page {claimPage} of {claimTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setClaimPage(page => Math.min(claimTotalPages, page + 1))}
                disabled={claimPage >= claimTotalPages || claimLoading}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Claim Reward Modal */}
      {purchasingItem && (
        <BottomSheet
          isOpen={!!purchasingItem}
          title="Claim Reward Target"
          onClose={() => setPurchasingItem(null)}
          maxWidthClassName="max-w-md"
        >
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">{purchasingItem.name}</h4>
                <span className="text-xs text-muted-foreground font-medium">Goal Target</span>
              </div>
              <span className="text-lg font-extrabold text-blue-500">{formatSensitive(purchasingItem.price)}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">Purchased Date</label>
              <DatePicker
                value={purchaseDateInput}
                onChange={setPurchaseDateInput}
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                Select the date this reward was acquired. A ledger transaction will be logged on this date.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="ghost" className="flex-1" onClick={() => setPurchasingItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold" onClick={handleConfirmPurchase}>
                Claim & Log to Ledger
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <BottomSheet
          isOpen={showAddModal}
          title="Add New Wish Goal"
          onClose={closeAddModal}
          maxWidthClassName="max-w-md"
        >
          <WishlistItemForm
            mode="add"
            currency={currency}
            name={nameInput}
            price={priceInput}
            priority={priorityInput}
            isActive={isActiveInput}
            errors={errors}
            onNameChange={setNameInput}
            onPriceChange={handlePriceChange}
            onPriorityChange={setPriorityInput}
            onActiveChange={setIsActiveInput}
            onClearError={field => setErrors(previous => ({ ...previous, [field]: '' }))}
            onCancel={closeAddModal}
            onSubmit={handleSaveAdd}
          />
        </BottomSheet>
      )}

      {/* Add / Edit Commitment */}
      {goalForm.showAddModal && (
        <BottomSheet
          isOpen={goalForm.showAddModal}
          title="Add a Commitment"
          onClose={goalForm.closeAddModal}
          maxWidthClassName="max-w-md"
        >
          <SavingsGoalForm
            mode="add"
            currency={currency}
            name={goalForm.nameInput}
            target={goalForm.targetInput}
            date={goalForm.dateInput}
            priority={goalForm.priorityInput}
            isRecurring={goalForm.isRecurringInput}
            recurrenceMonths={goalForm.recurrenceMonthsInput}
            errors={goalForm.errors}
            onNameChange={goalForm.setNameInput}
            onTargetChange={goalForm.handleTargetChange}
            onDateChange={goalForm.setDateInput}
            onPriorityChange={goalForm.setPriorityInput}
            onRecurringChange={goalForm.setIsRecurringInput}
            onRecurrenceMonthsChange={goalForm.setRecurrenceMonthsInput}
            onClearError={field => goalForm.setErrors(previous => ({ ...previous, [field]: '' }))}
            onCancel={goalForm.closeAddModal}
            onSubmit={goalForm.handleSaveAdd}
          />
        </BottomSheet>
      )}

      {goalForm.showEditModal && goalForm.editingGoal && (
        <BottomSheet
          isOpen={goalForm.showEditModal}
          title="Edit Commitment"
          onClose={goalForm.closeEditModal}
          maxWidthClassName="max-w-md"
        >
          <SavingsGoalForm
            mode="edit"
            currency={currency}
            name={goalForm.nameInput}
            target={goalForm.targetInput}
            date={goalForm.dateInput}
            priority={goalForm.priorityInput}
            isRecurring={goalForm.isRecurringInput}
            recurrenceMonths={goalForm.recurrenceMonthsInput}
            errors={goalForm.errors}
            onNameChange={goalForm.setNameInput}
            onTargetChange={goalForm.handleTargetChange}
            onDateChange={goalForm.setDateInput}
            onPriorityChange={goalForm.setPriorityInput}
            onRecurringChange={goalForm.setIsRecurringInput}
            onRecurrenceMonthsChange={goalForm.setRecurrenceMonthsInput}
            onClearError={field => goalForm.setErrors(previous => ({ ...previous, [field]: '' }))}
            onCancel={goalForm.closeEditModal}
            onSubmit={goalForm.handleSaveEdit}
          />
        </BottomSheet>
      )}

      {/* Manual top-up / release for a single commitment */}
      {contributeTarget && (
        <SavingsGoalContributeSheet
          goal={contributeTarget.goal}
          mode={contributeTarget.mode}
          currency={currency}
          available={claimableBalance}
          suggested={pool.paces.get(contributeTarget.goal.id)?.requiredPerCycle ?? 0}
          formatSensitive={formatSensitive}
          onClose={() => setContributeTarget(null)}
          onConfirm={amount => {
            const goalId = contributeTarget.goal.id
            setContributeTarget(null)
            void onContributeToGoal(goalId, amount)
          }}
        />
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <BottomSheet
          isOpen={showEditModal}
          title="Edit Wish Goal"
          onClose={closeEditModal}
          maxWidthClassName="max-w-md"
        >
          <WishlistItemForm
            mode="edit"
            currency={currency}
            name={nameInput}
            price={priceInput}
            priority={priorityInput}
            isActive={isActiveInput}
            errors={errors}
            onNameChange={setNameInput}
            onPriceChange={handlePriceChange}
            onPriorityChange={setPriorityInput}
            onActiveChange={setIsActiveInput}
            onClearError={field => setErrors(previous => ({ ...previous, [field]: '' }))}
            onCancel={closeEditModal}
            onSubmit={handleSaveEdit}
          />
        </BottomSheet>
      )}
    </div>
  )
}
