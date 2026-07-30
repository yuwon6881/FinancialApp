import React, { useMemo } from 'react'
import type { WishlistItem, Transaction, SavingsGoal } from '../types'
import { BottomSheet } from './ui/BottomSheet'
import { DatePicker } from './ui/DatePicker'
import { CycleSkeleton } from './ui/Skeleton'
import { Card } from './ui/Card'
import { HorizontalRail } from './ui/HorizontalRail'
import { MONTH_NAMES, getCycleYearAndMonthForDate } from '../lib/cycle'
import { claimedWishlistChangeSignal, selectClaimedWishlistPage } from '../lib/claimedWishlist'
import { useSyncStatus } from '../lib/useOptimisticList'
import { getActiveWishlistItem, orderRewardsForRail } from '../lib/wishlist'
import { Button } from './ui/Button'
import { useAppContext } from '../contexts/AppContext'
import { useWishlistForm } from './wishlist/useWishlistForm'
import { WishlistItemForm } from './wishlist/WishlistItemForm'
import { useSavingsGoalForm } from './wishlist/useSavingsGoalForm'
import { SavingsGoalForm } from './wishlist/SavingsGoalForm'
import { SavingsGoalCard } from './wishlist/SavingsGoalCard'
import { RewardCard } from './wishlist/RewardCard'
import { RewardsPoolBar } from './wishlist/RewardsPoolBar'
import { SavingsGoalContributeSheet, type ContributeMode } from './wishlist/SavingsGoalContributeSheet'
import { getPaceStatus, summarizePool } from '../lib/savingsGoals'
import {
  Plus,
  Clock,
  CheckCircle2,
  Flag,
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
  // Prefer what actually landed over the last three cycles when there is history to go on; fall back
  // to the budgeted figure for a new user.
  const freeInflowPerCycle = useMemo(() => {
    const budgeted = Math.max(0, rewardsTarget - pool.requiredPerCycleTotal)
    if (!hasRewardsHistory) return budgeted
    return Math.max(0, pastThreeMonthsRewardsAverage - pool.requiredPerCycleTotal)
  }, [rewardsTarget, pastThreeMonthsRewardsAverage, hasRewardsHistory, pool.requiredPerCycleTotal])

  const activeItem = useMemo(() => getActiveWishlistItem(wishlist), [wishlist])

  // One ordered strip replaces the old hero-plus-queue split, which rendered the same item in two
  // different shapes. See orderRewardsForRail for the ordering rule.
  const rewardItems = useMemo(() => orderRewardsForRail(wishlist, activeItem), [wishlist, activeItem])

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
          onFundCycle={() => { void onFundGoalsForCycle() }}
          onViewRewardsHistory={onNavigateToLedger
            ? () => onNavigateToLedger({ category: 'Rewards', showAllCycles: true })
            : undefined}
        />
      )}

      {/* Two rows over one pool. Each grows sideways rather than pushing the page down, so however
          many items exist the whole picture stays on one screen. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Flag className="size-4 text-violet-500" />
            Commitments
            {pool.activeGoals.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {pool.activeGoals.length}
              </span>
            )}
          </h3>
          <Button variant="secondary" size="sm" onClick={goalForm.handleOpenAddModal}>
            <Plus className="size-3" /> Add
          </Button>
        </div>

        {pool.activeGoals.length > 0 ? (
          <HorizontalRail label="Commitments">
            {pool.activeGoals.map(goal => {
              const pace = pool.paces.get(goal.id)
              if (!pace) return null
              return (
                <SavingsGoalCard
                  key={goal.id}
                  goal={goal}
                  pace={pace}
                  status={getPaceStatus(pace)}
                  formatSensitive={formatSensitive}
                  hideSensitive={hideSensitive}
                  isSyncing={isGoalSyncing(goal.id)}
                  isDeleting={isGoalDeleting(goal.id)}
                  onEdit={goalForm.handleOpenEditModal}
                  onDelete={onDeleteGoal}
                  onComplete={onCompleteGoal}
                  onTopUp={target => setContributeTarget({ goal: target, mode: 'topUp' })}
                  onRelease={target => setContributeTarget({ goal: target, mode: 'release' })}
                />
              )
            })}
            {/* Completed goals ride along as compact chips rather than a second card below: they are
                history, but throwing them away entirely would lose the record. */}
            {completedGoals.map(goal => (
              <div
                key={goal.id}
                className="snap-start shrink-0 w-40 flex flex-col justify-center gap-1 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-4"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                  <CheckCircle2 className="size-3 shrink-0" /> Done
                </span>
                <span className="text-xs font-bold text-foreground truncate">{goal.name}</span>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {formatSensitive(goal.targetAmount)}
                </span>
              </div>
            ))}
          </HorizontalRail>
        ) : (
          <Card className="p-5 border-dashed text-center">
            <p className="text-xs text-muted-foreground">
              Nothing you need money ready for yet — a car service in three months, a house deposit in
              six years. Add one and we work out what to set aside each cycle.
            </p>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Trophy className="size-4 text-blue-500" />
              Rewards
              {affordableCount > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  {affordableCount} claimable
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
              From your {formatSensitive(claimableBalance)} free rewards
              {!activeItem || claimableBalance >= activeItem.price ? null : (
                <> · {activeItem.name} in {getTimelineString(activeItem.price, freeInflowPerCycle)}</>
              )}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleOpenAddModal}>
            <Plus className="size-3" /> Add
          </Button>
        </div>

        {rewardItems.length > 0 ? (
          <HorizontalRail label="Rewards">
            {rewardItems.map(item => (
              <RewardCard
                key={item.id}
                item={item}
                isFocused={activeItem?.id === item.id}
                claimableBalance={claimableBalance}
                formatSensitive={formatSensitive}
                hideSensitive={hideSensitive}
                isSyncing={isItemSyncing(item.id)}
                isDeleting={isItemDeleting(item.id)}
                onClaim={handleOpenClaimModal}
                onFocus={target => { void handleToggleActive(target) }}
                onEdit={handleOpenEditModal}
                onDelete={onDeleteItem}
              />
            ))}
          </HorizontalRail>
        ) : (
          <Card className="p-5 border-dashed text-center">
            <p className="text-xs text-muted-foreground">
              No rewards yet. Add something to save your spare rewards toward.
            </p>
          </Card>
        )}
      </section>

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
