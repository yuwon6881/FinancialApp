import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import type { SavingsGoal, WishlistItem } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { SavingsGoalContributeSheet, type ContributeMode } from './SavingsGoalContributeSheet'
import { SavingsGoalForm } from './SavingsGoalForm'
import { WishlistItemForm } from './WishlistItemForm'
import type { useSavingsGoalForm } from './useSavingsGoalForm'
import type { useWishlistForm } from './useWishlistForm'

interface Props {
  purchasingItem: WishlistItem | null
  setPurchasingItem: Dispatch<SetStateAction<WishlistItem | null>>
  purchaseDateInput: string
  setPurchaseDateInput: Dispatch<SetStateAction<string>>
  onConfirmPurchase: () => void
  wishlistForm: ReturnType<typeof useWishlistForm>
  goalForm: ReturnType<typeof useSavingsGoalForm>
  contributeTarget: { goal: SavingsGoal; mode: ContributeMode } | null
  setContributeTarget: Dispatch<SetStateAction<{ goal: SavingsGoal; mode: ContributeMode } | null>>
  rewardsPool: GoalPoolSummary
  essentialsPool: GoalPoolSummary
  claimableBalance: number
  freeAfterGoalPace: number
  goalPacePreview: number
  currency: string
  hideSensitive: boolean
  todayKey: string
  formatSensitive: (value: number) => ReactNode
  onContributeToGoal: (id: number, amount: number) => Promise<string | null> | void
}

export function CommitmentsRewardsSheets(props: Props) {
  const itemForm = props.wishlistForm
  const goalForm = props.goalForm
  return (
    <>
      {props.purchasingItem && (
        <BottomSheet isOpen title="Claim Reward" onClose={() => props.setPurchasingItem(null)} maxWidthClassName="max-w-md">
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 p-4">
              <div><h4 className="text-sm font-bold text-foreground">{props.purchasingItem.name}</h4><span className="text-xs font-medium text-muted-foreground">Reward</span></div>
              <span className="text-lg font-extrabold text-accent-ink">{props.formatSensitive(props.purchasingItem.price)}</span>
            </div>
            <FormField label="Purchased date" hint="Use this date for the ledger entry.">
              <DatePicker value={props.purchaseDateInput} onChange={props.setPurchaseDateInput} max={props.todayKey} className="w-full" />
            </FormField>
            {props.purchasingItem.price <= props.claimableBalance && props.purchasingItem.price > props.freeAfterGoalPace && (
              <p className="text-xs font-medium text-muted-foreground">
                Buying this leaves your commitments <span className="font-bold text-amber-500">{props.formatSensitive(Math.max(0, props.purchasingItem.price - props.freeAfterGoalPace))}</span> short this cycle.
              </p>
            )}
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" className="flex-1" onClick={() => props.setPurchasingItem(null)}>Cancel</Button>
              <Button variant="primary" className="flex-1 font-bold" onClick={props.onConfirmPurchase} disabled={props.hideSensitive}>Claim &amp; Log to Ledger</Button>
            </div>
          </div>
        </BottomSheet>
      )}

      {itemForm.showAddModal && (
        <BottomSheet isOpen title="Add Reward" onClose={itemForm.closeAddModal} maxWidthClassName="max-w-md">
          <WishlistItemForm mode="add" currency={props.currency} name={itemForm.nameInput} price={itemForm.priceInput} priority={itemForm.priorityInput} isActive={itemForm.isActiveInput} errors={itemForm.errors} onNameChange={itemForm.setNameInput} onPriceChange={itemForm.handlePriceChange} onPriorityChange={itemForm.setPriorityInput} onActiveChange={itemForm.setIsActiveInput} onClearError={field => itemForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={itemForm.closeAddModal} onSubmit={itemForm.handleSaveAdd} />
        </BottomSheet>
      )}

      {goalForm.showAddModal && (
        <BottomSheet isOpen title="Add Commitment" onClose={goalForm.closeAddModal} maxWidthClassName="max-w-md">
          <SavingsGoalForm mode="add" currency={props.currency} name={goalForm.nameInput} target={goalForm.targetInput} fundingBucket={goalForm.fundingBucketInput} date={goalForm.dateInput} priority={goalForm.priorityInput} isRecurring={goalForm.isRecurringInput} recurrenceMonths={goalForm.recurrenceMonthsInput} errors={goalForm.errors} releasedByLowerTarget={goalForm.releasedByLowerTarget} requiredPerCycle={props.goalPacePreview} formatSensitive={props.formatSensitive} onNameChange={goalForm.setNameInput} onTargetChange={goalForm.handleTargetChange} onFundingBucketChange={goalForm.setFundingBucketInput} onDateChange={goalForm.setDateInput} onPriorityChange={goalForm.setPriorityInput} onRecurringChange={goalForm.setIsRecurringInput} onRecurrenceMonthsChange={goalForm.setRecurrenceMonthsInput} onClearError={field => goalForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={goalForm.closeAddModal} onSubmit={goalForm.handleSaveAdd} />
        </BottomSheet>
      )}

      {goalForm.showEditModal && goalForm.editingGoal && (
        <BottomSheet isOpen title="Edit Commitment" onClose={goalForm.closeEditModal} maxWidthClassName="max-w-md">
          <SavingsGoalForm mode="edit" currency={props.currency} name={goalForm.nameInput} target={goalForm.targetInput} fundingBucket={goalForm.fundingBucketInput} date={goalForm.dateInput} priority={goalForm.priorityInput} isRecurring={goalForm.isRecurringInput} recurrenceMonths={goalForm.recurrenceMonthsInput} errors={goalForm.errors} releasedByLowerTarget={goalForm.releasedByLowerTarget} requiredPerCycle={props.goalPacePreview} formatSensitive={props.formatSensitive} onNameChange={goalForm.setNameInput} onTargetChange={goalForm.handleTargetChange} onFundingBucketChange={goalForm.setFundingBucketInput} onDateChange={goalForm.setDateInput} onPriorityChange={goalForm.setPriorityInput} onRecurringChange={goalForm.setIsRecurringInput} onRecurrenceMonthsChange={goalForm.setRecurrenceMonthsInput} onClearError={field => goalForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={goalForm.closeEditModal} onSubmit={goalForm.handleSaveEdit} />
        </BottomSheet>
      )}

      {props.contributeTarget && (
        <SavingsGoalContributeSheet
          goal={props.contributeTarget.goal}
          mode={props.contributeTarget.mode}
          currency={props.currency}
          available={(props.contributeTarget.goal.fundingBucket ?? 'Rewards') === 'Essentials' ? props.essentialsPool.unassigned : props.rewardsPool.unassigned}
          suggested={(props.contributeTarget.goal.fundingBucket ?? 'Rewards') === 'Essentials' ? props.essentialsPool.paces.get(props.contributeTarget.goal.id)?.requiredPerCycle ?? 0 : props.rewardsPool.paces.get(props.contributeTarget.goal.id)?.requiredPerCycle ?? 0}
          formatSensitive={props.formatSensitive}
          onClose={() => props.setContributeTarget(null)}
          onConfirm={async amount => {
            const rejection = await props.onContributeToGoal(props.contributeTarget!.goal.id, amount)
            if (!rejection) props.setContributeTarget(null)
            return rejection ?? null
          }}
        />
      )}

      {itemForm.showEditModal && itemForm.editingItem && (
        <BottomSheet isOpen title="Edit Reward" onClose={itemForm.closeEditModal} maxWidthClassName="max-w-md">
          <WishlistItemForm mode="edit" currency={props.currency} name={itemForm.nameInput} price={itemForm.priceInput} priority={itemForm.priorityInput} isActive={itemForm.isActiveInput} errors={itemForm.errors} onNameChange={itemForm.setNameInput} onPriceChange={itemForm.handlePriceChange} onPriorityChange={itemForm.setPriorityInput} onActiveChange={itemForm.setIsActiveInput} onClearError={field => itemForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={itemForm.closeEditModal} onSubmit={itemForm.handleSaveEdit} />
        </BottomSheet>
      )}
    </>
  )
}
