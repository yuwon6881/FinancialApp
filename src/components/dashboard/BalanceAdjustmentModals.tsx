import { Input } from '../ui/Input'
import React from 'react'
import type { CategorySummary } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { CustomConfirmModal } from '../ui/CustomConfirmModal'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import type { PendingBalanceAdjustment } from './useDashboardView'
import { FormField } from '../ui/FormField'
import { focusFirstInvalidField } from '../ui/formValidation'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

interface BalanceAdjustmentModalsProps {
  adjustingCategory: CategorySummary | null
  newBalanceInput: string
  accountBalanceInputs: Record<string, string>
  balanceErrors: Record<string, string>
  adjustmentDescription: string
  pendingBalanceAdjustment: PendingBalanceAdjustment | null
  isAdjustmentUnchanged: boolean
  adjustmentPreviewDiff: number | null
  formatSensitive: (val: number) => React.ReactNode
  onBalanceInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onAccountBalanceInputChange: (accountId: string, rawValue: string) => void
  onDescriptionChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClose: () => void
  onReview: () => void
  onCancelPending: () => void
  onConfirmPending: () => void
}

export const BalanceAdjustmentModals: React.FC<BalanceAdjustmentModalsProps> = ({
  adjustingCategory,
  newBalanceInput,
  accountBalanceInputs,
  balanceErrors,
  adjustmentDescription,
  pendingBalanceAdjustment,
  isAdjustmentUnchanged,
  adjustmentPreviewDiff,
  formatSensitive,
  onBalanceInputChange,
  onAccountBalanceInputChange,
  onDescriptionChange,
  onClose,
  onReview,
  onCancelPending,
  onConfirmPending,
}) => {
  return (
    <>
      {/* Adjust Balance Modal */}
      {adjustingCategory && (
        <BottomSheet
          isOpen={!!adjustingCategory}
          title={`Adjust ${adjustingCategory.name} Balance`}
          onClose={onClose}
          maxWidthClassName="max-w-sm"
          footer={
            <ModalActions>
              <Button
                variant="outline"
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="balance-adjustment-form"
                disabled={isAdjustmentUnchanged}
                className="rounded-xl px-4 py-2 shadow-md"
              >
                Review Adjustment
              </Button>
            </ModalActions>
          }
        >
          <form
            id="balance-adjustment-form"
            noValidate
            className="text-xs space-y-3"
            onSubmit={event => {
              event.preventDefault()
              onReview()
              focusFirstInvalidField(event.currentTarget)
            }}
          >
            {adjustingCategory.accounts?.length ? (
              <div className="space-y-3">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Current bucket total:</span>
                  <span className="font-bold text-foreground">{formatSensitive(adjustingCategory.remaining)}</span>
                </div>
                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Set each open account separately. Closed accounts are kept in the total but cannot be edited.
                  </p>
                  {adjustingCategory.accounts.map(account => (
                    <FormField key={account.id} label={`${account.name}${account.isArchived ? ' (Closed)' : ''}`} error={account.isArchived ? undefined : balanceErrors[account.id]}>
                      <SmartAmountInput
                        type="text"
                        placeholder="0.00"
                        value={accountBalanceInputs[account.id] ?? ''}
                        disabled={account.isArchived}
                        onChange={event => onAccountBalanceInputChange(account.id, event.target.value)}
                      />
                    </FormField>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Current Remaining Balance:</span>
                  <span className="font-bold text-foreground">{formatSensitive(adjustingCategory.remaining)}</span>
                </div>

                <FormField label="Target remaining balance" required error={balanceErrors.balance}>
                  <SmartAmountInput
                    type="text"
                    placeholder="0.00"
                    value={newBalanceInput}
                    onChange={onBalanceInputChange}
                  />
                </FormField>
              </>
            )}

            <FormField label="Adjustment description" required error={balanceErrors.description}>
              <Input
                type="text"
                required
                placeholder="e.g. Ledger alignment"
                value={adjustmentDescription}
                onChange={onDescriptionChange}
              />
            </FormField>

            {adjustmentPreviewDiff !== null && (
              <div className="p-3 bg-muted/40 border border-border/50 rounded-xl text-[10px] text-muted-foreground select-none">
                Calculated ledger entry: <span className={`font-bold ${adjustmentPreviewDiff > 0 ? 'text-blue-500' : adjustmentPreviewDiff < 0 ? 'text-orange-500' : ''}`}>
                  {adjustmentPreviewDiff > 0 ? '+' : ''}{formatSensitive(adjustmentPreviewDiff)}
                </span>
              </div>
            )}
          </form>
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
              This will immediately record {pendingBalanceAdjustment.transactions.length > 1 ? 'separate ledger adjustments for the accounts in' : 'a ledger adjustment for'} <span className="font-semibold text-foreground">{pendingBalanceAdjustment.categoryName}</span>.
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
            {pendingBalanceAdjustment.accountAdjustments.length > 0 && (
              <div className="space-y-1 rounded-xl border border-border/60 bg-muted/20 p-3">
                {pendingBalanceAdjustment.accountAdjustments.map(account => (
                  <div key={account.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="truncate">{account.name}</span>
                    <span className={`shrink-0 font-bold ${account.diff > 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                      {account.diff > 0 ? '+' : ''}{formatSensitive(account.diff)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              This will be pushed to the server immediately and will not be added to the ledger draft queue.
            </p>
          </div>
        )}
        onCancel={onCancelPending}
        onConfirm={onConfirmPending}
      />
    </>
  )
}
