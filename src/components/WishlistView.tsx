import React, { useMemo } from 'react'
import type { WishlistItem, SavingsGoal } from '../types'
import { BottomSheet } from './ui/BottomSheet'
import { DatePicker } from './ui/DatePicker'
import { FormField } from './ui/FormField'
import { CycleSkeleton } from './ui/Skeleton'
import { Card } from './ui/Card'
import { HorizontalRail } from './ui/HorizontalRail'
import { useSyncStatus } from '../lib/useOptimisticList'
import { getActiveWishlistItem, orderRewardsForRail } from '../lib/wishlist'
import { Button } from './ui/Button'
import { useAppContext } from '../contexts/AppContext'
import { useWishlistForm } from './wishlist/useWishlistForm'
import { WishlistItemForm } from './wishlist/WishlistItemForm'
import { useSavingsGoalForm } from './wishlist/useSavingsGoalForm'
import { SavingsGoalForm } from './wishlist/SavingsGoalForm'
import { CommitmentsSection } from './wishlist/CommitmentsSection'
import { RewardCard } from './wishlist/RewardCard'
import { RewardsPoolBar } from './wishlist/RewardsPoolBar'
import { SavingsGoalContributeSheet, type ContributeMode } from './wishlist/SavingsGoalContributeSheet'
import { InfoHint } from './ui/InfoHint'
import { previewRequiredPerCycle, summarizePool } from '../lib/savingsGoals'
import {
  Plus,
  Trophy,
  Sparkles,
} from 'lucide-react'

interface WishlistViewProps {
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  rewardsBalance: number
  pendingRewardsDeduction?: number
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
  /** Resolves to the server's rejection message, or null when the move stuck. */
  onContributeToGoal: (id: number, amount: number) => Promise<string | null> | void
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
  activeSyncId?: string | null
  activeSyncIds?: string[]
  deletingId?: string | null
  isSwitchingCycle?: boolean
  // Signals to the parent's drain loop which item is being edited, so the
  // corresponding queued op isn't dispatched while the edit modal is open.
  onStartEditPending?: (id: string | null) => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  onExplainWithAi?: () => void
  aiSavingsGoalDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiSavingsGoalEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiSavingsGoalDraftConsumed?: () => void
  onAiSavingsGoalEditDraftConsumed?: () => void
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  wishlist,
  savingsGoals,
  rewardsBalance,
  pendingRewardsDeduction = 0,
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
  activeSyncId: activeSyncIdProp,
  activeSyncIds: activeSyncIdsProp,
  deletingId: deletingIdProp,
  isSwitchingCycle = false,
  onStartEditPending,
  aiDraft = null,
  aiEditDraft = null,
  onAiDraftConsumed,
  onAiEditDraftConsumed,
  onExplainWithAi,
  aiSavingsGoalDraft,
  aiSavingsGoalEditDraft,
  onAiSavingsGoalDraftConsumed,
  onAiSavingsGoalEditDraftConsumed,
}) => {
  const app = useAppContext()
  const currency = currencyProp ?? app.currency
  const hideSensitive = hideSensitiveProp ?? app.hideSensitive
  const formatSensitive = formatSensitiveProp ?? app.formatSensitive
  const activeSyncIds = activeSyncIdsProp
    ?? (activeSyncIdProp !== undefined
      ? (activeSyncIdProp ? [activeSyncIdProp] : [])
      : (app.activeSyncIds?.length ? app.activeSyncIds : (app.activeSyncId ? [app.activeSyncId] : [])))
  const deletingId = deletingIdProp ?? app.deletingId
  const { isSyncing: isItemSyncing, isDeleting: isItemDeleting } = useSyncStatus(wishlist, activeSyncIds, deletingId)

  const [purchasingItem, setPurchasingItem] = React.useState<WishlistItem | null>(null)
  const [purchaseDateInput, setPurchaseDateInput] = React.useState<string>(new Date().toLocaleDateString('en-CA'))

  const handleOpenClaimModal = (item: WishlistItem) => {
    if (hideSensitive) return
    setPurchaseDateInput(new Date().toLocaleDateString('en-CA'))
    setPurchasingItem(item)
  }

  const handleConfirmPurchase = () => {
    if (hideSensitive) return
    if (!purchasingItem) return
    void onPurchaseItem(purchasingItem.id, purchaseDateInput)
    setPurchasingItem(null)
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
    sensitivePreferenceStatus: app.sensitivePreferenceStatus,
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
    aiDraft: aiSavingsGoalDraft,
    aiEditDraft: aiSavingsGoalEditDraft,
    onAiDraftConsumed: onAiSavingsGoalDraftConsumed,
    onAiEditDraftConsumed: onAiSavingsGoalEditDraftConsumed,
  })

  const { isSyncing: isGoalSyncing, isDeleting: isGoalDeleting } = useSyncStatus(savingsGoals, activeSyncIds, deletingId)
  const isFunding = activeSyncIds.some(id => String(id) === 'savings-goals-fund')
  const [contributeTarget, setContributeTarget] = React.useState<{ goal: SavingsGoal; mode: ContributeMode } | null>(null)

  React.useEffect(() => {
    if (!hideSensitive) return
    setPurchasingItem(null)
    setContributeTarget(null)
  }, [hideSensitive])

  // --- The shared pool ------------------------------------------------------------------------
  // One Rewards balance, two kinds of claim on it. Everything below is derived from this single
  // summary so the pool bar, the goal cards and the wishlist progress cannot disagree about how
  // the same money is divided.
  // Keyed on the local calendar day rather than memoised once on mount. This is an installed PWA
  // that is routinely left open across midnight, and a `today` frozen at mount kept reporting a
  // commitment as on pace into the day its deadline had already passed. `today` only ever resolves
  // a cycle and a calendar day downstream, so local midnight is the honest instant to hand it.
  const todayKey = new Date().toLocaleDateString('en-CA')
  const today = React.useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey])
  const pool = useMemo(
    () => summarizePool(savingsGoals, rewardsBalance, rewardsTarget, today, cycleDay, pendingRewardsDeduction),
    [savingsGoals, rewardsBalance, rewardsTarget, today, cycleDay, pendingRewardsDeduction],
  )

  const completedGoals = useMemo(
    () => savingsGoals.filter(goal => goal.status === 'completed'),
    [savingsGoals],
  )

  // What the amount and deadline currently typed into the form would ask for each cycle. The
  // deadline is the input and the contribution is the output, so without this the one number a
  // commitment is actually judged on only appeared after saving it.
  const goalPacePreview = useMemo(
    () => previewRequiredPerCycle(
      Number.parseFloat(goalForm.targetInput),
      goalForm.editingGoal?.earmarkedAmount ?? 0,
      goalForm.dateInput,
      today,
      cycleDay,
    ),
    [goalForm.targetInput, goalForm.editingGoal, goalForm.dateInput, today, cycleDay],
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

    // Derived from the day-keyed `today` above rather than a fresh mutated Date: `setDate` returns a
    // timestamp *and* mutates its receiver, so the old form shadowed the outer `today` with a value
    // it then moved months into the future — one call away from reading as the current date.
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + days)
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
    <div className="space-y-5">
      {/* One stacked bar over one balance. rewardsBalance/rewardsTarget are cycle-scoped, so show a
          skeleton while a new cycle's dashboard data loads rather than briefly flashing the
          previous cycle's numbers. */}
      {isSwitchingCycle ? (
        <CycleSkeleton variant="wishlist" />
      ) : (
        <>
          <header className="app-panel flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-5">
            {/* The subtitle costs a phone a whole line above the first number on the page, so on
                mobile it moves into the hint instead of being dropped — the explanation is still
                one tap away for anyone who wants it. */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Rewards plan</h2>
                <InfoHint
                  label="What the Rewards plan shows"
                  text="See what is free to spend now and what your commitments need next."
                  className="sm:hidden"
                />
              </div>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">See what is free now and what your commitments need next.</p>
            </div>
            {onExplainWithAi && (
              <Button variant="secondary" size="sm" type="button" onClick={onExplainWithAi}>
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">Explain my plan</span>
              </Button>
            )}
          </header>
          <RewardsPoolBar
            summary={pool}
            expectedInflow={rewardsTarget}
            formatSensitive={formatSensitive}
            hideSensitive={hideSensitive}
            isOffline={isOffline}
            isFunding={isFunding}
            onFundCycle={() => { void onFundGoalsForCycle() }}
            onViewRewardsHistory={onNavigateToLedger
              ? () => onNavigateToLedger({ category: 'Rewards', showAllCycles: true })
              : undefined}
          />
        </>
      )}

      {/* Two rows over one pool. Each grows sideways rather than pushing the page down, so however
          many items exist the whole picture stays on one screen. */}
      <CommitmentsSection
        pool={pool}
        completedGoals={completedGoals}
        formatSensitive={formatSensitive}
        hideSensitive={hideSensitive}
        isGoalSyncing={isGoalSyncing}
        isGoalDeleting={isGoalDeleting}
        onAddGoal={goalForm.handleOpenAddModal}
        onEditGoal={goalForm.handleOpenEditModal}
        onDeleteGoal={onDeleteGoal}
        onCompleteGoal={onCompleteGoal}
        onTopUp={target => setContributeTarget({ goal: target, mode: 'topUp' })}
        onRelease={target => setContributeTarget({ goal: target, mode: 'release' })}
      />

      {/* Same panel shell as Commitments above, for the same reason. */}
      <section
        aria-labelledby="wishlist-rewards-heading"
        className="app-panel space-y-3 rounded-2xl border border-border/60 bg-card/92 p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="wishlist-rewards-heading" className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Trophy className="size-4 text-pink-500" />
              Rewards
              {affordableCount > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                  {affordableCount} claimable
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              From your {formatSensitive(claimableBalance)} free rewards
              {!activeItem || claimableBalance >= activeItem.price ? null : (
                <> · {activeItem.name} in {getTimelineString(activeItem.price, freeInflowPerCycle)}</>
              )}
            </p>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0" onClick={handleOpenAddModal} disabled={hideSensitive} title={hideSensitive ? 'Unhide balances to add a reward' : undefined}>
            <Plus className="size-3" /> Add reward
          </Button>
        </div>

        {rewardItems.length > 0 ? (
          <HorizontalRail label="Rewards" showControls>
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
            <p className="text-xs text-muted-foreground">No rewards yet. Add one to save toward.</p>
          </Card>
        )}
      </section>

      {/* Claim Reward Modal */}
      {purchasingItem && (
        <BottomSheet
          isOpen={!!purchasingItem}
          title="Claim Reward Target"
          onClose={() => setPurchasingItem(null)}
          maxWidthClassName="max-w-md"
        >
          <div className="space-y-4 py-2">
            {/* Money emphasis is the theme's own primary tint, as on the split-receipt sheet — a
                blue step here read as a different design system from the totals it mirrors. */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">{purchasingItem.name}</h4>
                <span className="text-xs text-muted-foreground font-medium">Reward target</span>
              </div>
              <span className="text-lg font-extrabold text-accent-ink">{formatSensitive(purchasingItem.price)}</span>
            </div>

            <FormField
              label="Purchased date"
              hint="Use this date for the ledger entry."
            >
              <DatePicker
                value={purchaseDateInput}
                onChange={setPurchaseDateInput}
                className="w-full"
              />
            </FormField>

            <div className="flex gap-2 pt-4">
              <Button variant="ghost" className="flex-1" onClick={() => setPurchasingItem(null)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold" onClick={handleConfirmPurchase} disabled={hideSensitive}>
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
            releasedByLowerTarget={goalForm.releasedByLowerTarget}
            requiredPerCycle={goalPacePreview}
            formatSensitive={formatSensitive}
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
            releasedByLowerTarget={goalForm.releasedByLowerTarget}
            requiredPerCycle={goalPacePreview}
            formatSensitive={formatSensitive}
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
          onConfirm={async amount => {
            const rejection = await onContributeToGoal(contributeTarget.goal.id, amount)
            // Only a clean move closes the sheet; a refusal stays put with the
            // reason on the amount field.
            if (!rejection) setContributeTarget(null)
            return rejection ?? null
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
