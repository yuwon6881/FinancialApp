import type { Dispatch, ReactNode, SetStateAction } from 'react'
import type { GoalPoolSummary } from '../../lib/savingsGoals'
import type { LedgerAccount, SavingsGoal, WishlistItem } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { DatePicker } from '../ui/DatePicker'
import { FormField } from '../ui/FormField'
import { CustomSelect } from '../ui/CustomSelect'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'
import { SavingsGoalContributeSheet, type ContributeMode } from './SavingsGoalContributeSheet'
import { SavingsGoalForm } from './SavingsGoalForm'
import { WishlistItemForm } from './WishlistItemForm'
import type { useSavingsGoalForm } from './useSavingsGoalForm'
import type { useWishlistForm } from './useWishlistForm'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'

interface Props {
  purchasingItem: WishlistItem | null
  setPurchasingItem: Dispatch<SetStateAction<WishlistItem | null>>
  purchaseDateInput: string
  setPurchaseDateInput: Dispatch<SetStateAction<string>>
  onConfirmPurchase: () => void
  purchaseAccountId: string
  setPurchaseAccountId: (value: string) => void
  purchaseError: string
  completingGoal: SavingsGoal | null
  setCompletingGoal: Dispatch<SetStateAction<SavingsGoal | null>>
  completionAccountId: string
  setCompletionAccountId: (value: string) => void
  accounts: LedgerAccount[]
  onConfirmCompletion: () => void
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
  sensitivePreferenceStatus?: SensitivePreferenceStatus
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
            <FormField label="Paid from account" required error={props.purchaseError}>
              <CustomSelect
                ariaLabel="Paid from account"
                value={props.purchaseAccountId}
                onChange={props.setPurchaseAccountId}
                invalid={Boolean(props.purchaseError)}
                options={[
                  { value: '', label: 'Choose a Rewards account', disabled: true },
                  ...props.accounts
                    .filter(account => account.bucket === 'Rewards' && !account.isArchived)
                    .map(account => ({ value: account.id, label: account.name })),
                ]}
                className="w-full"
              />
            </FormField>
            {props.purchasingItem.price <= props.claimableBalance && props.purchasingItem.price > props.freeAfterGoalPace && (
              <p className="text-xs font-medium text-muted-foreground">
                Buying this leaves your commitments <span className="font-bold text-amber-500">{props.formatSensitive(Math.max(0, props.purchasingItem.price - props.freeAfterGoalPace))}</span> short this cycle.
              </p>
            )}
            <ModalActions className="pt-4">
              <Button variant="outline" className="rounded-xl" onClick={() => props.setPurchasingItem(null)}>Cancel</Button>
              <Button variant="primary" className="rounded-xl font-bold shadow-md" onClick={props.onConfirmPurchase} disabled={props.hideSensitive}>Claim &amp; Log to Ledger</Button>
            </ModalActions>
          </div>
        </BottomSheet>
      )}

      {props.completingGoal && (
        <BottomSheet isOpen title="Complete Commitment" onClose={() => props.setCompletingGoal(null)} maxWidthClassName="max-w-md">
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Record <span className="font-semibold text-foreground">{props.completingGoal.name}</span> in its bucket ledger account.
            </p>
            <FormField label="Account" required>
              <CustomSelect
                ariaLabel="Commitment completion account"
                value={props.completionAccountId}
                onChange={props.setCompletionAccountId}
                options={[
                  { value: '', label: 'Choose an account', disabled: true },
                  ...props.accounts
                    .filter(account => account.bucket === (props.completingGoal?.fundingBucket ?? 'Rewards') && !account.isArchived)
                    .map(account => ({ value: account.id, label: account.name })),
                ]}
                className="w-full"
              />
            </FormField>
            <ModalActions className="pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => props.setCompletingGoal(null)}>Cancel</Button>
              <Button variant="primary" className="rounded-xl font-bold shadow-md" onClick={props.onConfirmCompletion} disabled={props.hideSensitive || !props.completionAccountId}>
                Complete &amp; Log to Ledger
              </Button>
            </ModalActions>
          </div>
        </BottomSheet>
      )}

      {itemForm.showAddModal && (
        <BottomSheet isOpen title="Add Reward" onClose={itemForm.closeAddModal} maxWidthClassName="max-w-md">
          <WishlistItemForm mode="add" mutationBlocked={props.hideSensitive || props.sensitivePreferenceStatus === 'pending'} securityPending={props.sensitivePreferenceStatus === 'pending'} currency={props.currency} name={itemForm.nameInput} price={itemForm.priceInput} priority={itemForm.priorityInput} isActive={itemForm.isActiveInput} errors={itemForm.errors} onNameChange={itemForm.setNameInput} onPriceChange={itemForm.handlePriceChange} onPriorityChange={itemForm.setPriorityInput} onActiveChange={itemForm.setIsActiveInput} onClearError={field => itemForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={itemForm.closeAddModal} onSubmit={itemForm.handleSaveAdd} />
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
          suggestedTopUp={(props.contributeTarget.goal.fundingBucket ?? 'Rewards') === 'Essentials' ? props.essentialsPool.paces.get(props.contributeTarget.goal.id)?.outstandingThisCycle ?? 0 : props.rewardsPool.paces.get(props.contributeTarget.goal.id)?.outstandingThisCycle ?? 0}
          suggestedRelease={(props.contributeTarget.goal.fundingBucket ?? 'Rewards') === 'Essentials' ? props.essentialsPool.paces.get(props.contributeTarget.goal.id)?.requiredPerCycle ?? 0 : props.rewardsPool.paces.get(props.contributeTarget.goal.id)?.requiredPerCycle ?? 0}
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
          <WishlistItemForm mode="edit" mutationBlocked={props.hideSensitive || props.sensitivePreferenceStatus === 'pending'} securityPending={props.sensitivePreferenceStatus === 'pending'} currency={props.currency} name={itemForm.nameInput} price={itemForm.priceInput} priority={itemForm.priorityInput} isActive={itemForm.isActiveInput} errors={itemForm.errors} onNameChange={itemForm.setNameInput} onPriceChange={itemForm.handlePriceChange} onPriorityChange={itemForm.setPriorityInput} onActiveChange={itemForm.setIsActiveInput} onClearError={field => itemForm.setErrors(previous => ({ ...previous, [field]: '' }))} onCancel={itemForm.closeEditModal} onSubmit={itemForm.handleSaveEdit} />
        </BottomSheet>
      )}
    </>
  )
}
