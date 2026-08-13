import React from 'react'
import type { WishlistItem, SavingsGoal, SavingsGoalFundingBucket } from '../types'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useSyncStatus } from '../lib/useOptimisticList'
import { Button } from './ui/Button'
import { useAppContext } from '../contexts/AppContext'
import { useWishlistForm } from './wishlist/useWishlistForm'
import { useSavingsGoalForm } from './wishlist/useSavingsGoalForm'
import { CommitmentsSection } from './wishlist/CommitmentsSection'
import { RewardsPoolBar } from './wishlist/RewardsPoolBar'
import type { ContributeMode } from './wishlist/SavingsGoalContributeSheet'
import { CommitmentsRewardsTabs, type CommitmentsRewardsTabId } from './wishlist/CommitmentsRewardsTabs'
import { useCommitmentsRewardsData } from './wishlist/useCommitmentsRewardsData'
import { RewardsSection } from './wishlist/RewardsSection'
import { CommitmentsRewardsSheets } from './wishlist/CommitmentsRewardsSheets'
import { CommitmentIcon } from './semanticIcons'
import { Sparkles } from 'lucide-react'

interface CommitmentsRewardsViewProps {
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  rewardsBalance: number
  pendingRewardsDeduction?: number
  essentialsBalance?: number
  pendingEssentialsDeduction?: number
  essentialsTarget?: number
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
  onFundGoalsForCycle: (bucket?: SavingsGoalFundingBucket) => Promise<void> | void
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
  onExplainWithAi?: () => void
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
  aiSavingsGoalDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiSavingsGoalEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiSavingsGoalDraftConsumed?: () => void
  onAiSavingsGoalEditDraftConsumed?: () => void
}

export const CommitmentsRewardsView: React.FC<CommitmentsRewardsViewProps> = ({
  wishlist,
  savingsGoals,
  rewardsBalance,
  pendingRewardsDeduction = 0,
  essentialsBalance = 0,
  pendingEssentialsDeduction = 0,
  essentialsTarget = 0,
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
  const [activeTab, setActiveTab] = React.useState<CommitmentsRewardsTabId>('commitments')

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

  const wishlistForm = useWishlistForm({
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

  const {
    todayKey,
    rewardsPool,
    essentialsPool,
    commitmentsPool,
    completedGoals,
    goalPacePreview,
    claimableBalance,
    freeAfterGoalPace,
    activeItem,
    rewardItems,
    affordableCount,
    rewardTimeline,
  } = useCommitmentsRewardsData({
    wishlist,
    savingsGoals,
    rewardsBalance,
    rewardsTarget,
    pendingRewardsDeduction,
    essentialsBalance,
    essentialsTarget,
    pendingEssentialsDeduction,
    pastThreeMonthsRewardsAverage,
    hasRewardsHistory,
    cycleDay,
    goalTargetInput: goalForm.targetInput,
    editingGoal: goalForm.editingGoal,
    goalDateInput: goalForm.dateInput,
  })

  const handleToggleActive = async (item: WishlistItem) => {
    if (hideSensitive) return
    await onUpdateItem(item.id, {
      ...item,
      isActive: true,
    })
  }

  return (
    <div className="space-y-5">
      <header className="app-panel rounded-2xl border border-border/60 bg-card/92 p-3 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-accent-ink">
              <CommitmentIcon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Commitments &amp; Rewards</h2>
              <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Set money aside for commitments, then see what is free for rewards.</p>
            </div>
          </div>
          {onExplainWithAi && (
            <Button variant="secondary" size="sm" type="button" onClick={onExplainWithAi} aria-label="Explain my commitments and rewards plan with Ask AI" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5">
              <Sparkles className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Explain my plan</span>
            </Button>
          )}
        </div>
      </header>

      <CommitmentsRewardsTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        commitmentsCount={commitmentsPool.activeGoals.length + completedGoals.length}
        rewardsCount={rewardItems.length}
      />

      {isSwitchingCycle ? (
        <CycleSkeleton variant="wishlist" />
      ) : activeTab === 'commitments' ? (
        <div id="commitments-rewards-panel-commitments" role="tabpanel" aria-labelledby="commitments-rewards-tab-commitments" className="space-y-5">
          <RewardsPoolBar
            summary={rewardsPool}
            activeView="commitments"
            bucket="Rewards"
            expectedInflow={rewardsTarget}
            formatSensitive={formatSensitive}
            hideSensitive={hideSensitive}
            isOffline={isOffline}
            isFunding={isFunding}
            onFundCycle={() => { void onFundGoalsForCycle('Rewards') }}
            onViewRewardsHistory={onNavigateToLedger ? () => onNavigateToLedger({ category: 'Rewards', showAllCycles: true }) : undefined}
          />
          {essentialsPool.activeGoals.length > 0 && (
            <RewardsPoolBar summary={essentialsPool} bucket="Essentials" expectedInflow={essentialsTarget} formatSensitive={formatSensitive} hideSensitive={hideSensitive} isOffline={isOffline} isFunding={isFunding} onFundCycle={() => { void onFundGoalsForCycle('Essentials') }} />
          )}
          <CommitmentsSection
            pool={commitmentsPool}
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
        </div>
      ) : (
        <div id="commitments-rewards-panel-rewards" role="tabpanel" aria-labelledby="commitments-rewards-tab-rewards" className="space-y-5">
          <RewardsPoolBar
            summary={rewardsPool}
            activeView="rewards"
            bucket="Rewards"
            expectedInflow={rewardsTarget}
            formatSensitive={formatSensitive}
            hideSensitive={hideSensitive}
            isOffline={isOffline}
            isFunding={isFunding}
            onFundCycle={() => { void onFundGoalsForCycle('Rewards') }}
            onViewRewardsHistory={onNavigateToLedger ? () => onNavigateToLedger({ category: 'Rewards', showAllCycles: true }) : undefined}
          />
          <RewardsSection
            items={rewardItems}
            activeItem={activeItem}
            affordableCount={affordableCount}
            claimableBalance={claimableBalance}
            freeAfterGoalPace={freeAfterGoalPace}
            formatSensitive={formatSensitive}
            hideSensitive={hideSensitive}
            rewardTimeline={rewardTimeline}
            isSyncing={isItemSyncing}
            isDeleting={isItemDeleting}
            onAdd={wishlistForm.handleOpenAddModal}
            onClaim={handleOpenClaimModal}
            onFocus={target => { void handleToggleActive(target) }}
            onEdit={wishlistForm.handleOpenEditModal}
            onDelete={onDeleteItem}
          />
        </div>
      )}

      <CommitmentsRewardsSheets
        purchasingItem={purchasingItem}
        setPurchasingItem={setPurchasingItem}
        purchaseDateInput={purchaseDateInput}
        setPurchaseDateInput={setPurchaseDateInput}
        onConfirmPurchase={handleConfirmPurchase}
        wishlistForm={wishlistForm}
        goalForm={goalForm}
        contributeTarget={contributeTarget}
        setContributeTarget={setContributeTarget}
        rewardsPool={rewardsPool}
        essentialsPool={essentialsPool}
        claimableBalance={claimableBalance}
        freeAfterGoalPace={freeAfterGoalPace}
        goalPacePreview={goalPacePreview}
        currency={currency}
        hideSensitive={hideSensitive}
        sensitivePreferenceStatus={app.sensitivePreferenceStatus}
        todayKey={todayKey}
        formatSensitive={formatSensitive}
        onContributeToGoal={onContributeToGoal}
      />
    </div>
  )
}
