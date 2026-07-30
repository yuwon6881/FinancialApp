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
  balanceErrors: Record<string, string>
  adjustmentDescription: string
  pendingBalanceAdjustment: PendingBalanceAdjustment | null
  isAdjustmentUnchanged: boolean
  adjustmentPreviewDiff: number | null
  formatSensitive: (val: number) => React.ReactNode
  onBalanceInputChange: (rawValue: string) => void
  onDescriptionChange: (value: string) => void
  onClose: () => void
  onReview: () => void
  onCancelPending: () => void
  onConfirmPending: () => void
}

export const BalanceAdjustmentModals: React.FC<BalanceAdjustmentModalsProps> = ({
  adjustingCategory,
  newBalanceInput,
  balanceErrors,
  adjustmentDescription,
  pendingBalanceAdjustment,
  isAdjustmentUnchanged,
  adjustmentPreviewDiff,
  formatSensitive,
  onBalanceInputChange,
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
            <div>
              <span className="text-muted-foreground block mb-0.5">Current Remaining Balance:</span>
              <span className="font-bold text-foreground">{formatSensitive(adjustingCategory.remaining)}</span>
            </div>

            <FormField label="Target remaining balance" required error={balanceErrors.balance}>
              <SmartAmountInput
                type="text"
                placeholder="0.00"
                value={newBalanceInput}
                onChange={e => onBalanceInputChange(e.target.value)}
              />
            </FormField>

            <FormField label="Adjustment description" required error={balanceErrors.description}>
              <Input
                type="text"
                required
                placeholder="e.g. Ledger alignment"
                value={adjustmentDescription}
                onChange={e => onDescriptionChange(e.target.value)}
              />
            </FormField>

            {adjustmentPreviewDiff !== null && (
              <div className="p-3 bg-muted/40 border border-border/50 rounded-xl text-[10px] text-muted-foreground select-none">
                Calculated ledger entry: <span className={`font-bold ${adjustmentPreviewDiff > 0 ? 'text-blue-500' : adjustmentPreviewDiff < 0 ? 'text-orange-500' : ''}`}>
                  {adjustmentPreviewDiff > 0 ? '+' : ''}{adjustmentPreviewDiff.toFixed(2)}
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
        onCancel={onCancelPending}
        onConfirm={onConfirmPending}
      />
    </>
  )
}
