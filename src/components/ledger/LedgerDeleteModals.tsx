import { Checkbox } from '../ui/Checkbox'
import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Transaction } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

interface DeleteTransactionModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onCancel: () => void
  onConfirm: () => void
  formatSensitive: (val: number) => ReactNode
  attachedDocumentCount?: number
  alsoDeleteDocuments?: boolean
  onAlsoDeleteDocumentsChange?: (val: boolean) => void
  isOnline?: boolean
  areAttachedDocumentsLoading?: boolean
}

// Confirm-deletion bottom sheet. Explains the cascade for Income Auto-Split
// main records and their split sub-records.
export function DeleteTransactionModal({
  isOpen,
  transaction,
  onCancel,
  onConfirm,
  formatSensitive,
  attachedDocumentCount = 0,
  alsoDeleteDocuments = false,
  onAlsoDeleteDocumentsChange,
  isOnline = true,
  areAttachedDocumentsLoading = false,
}: DeleteTransactionModalProps) {
  if (!isOpen || !transaction) return null
  const isSplitSubRecord = transaction.id.includes('-split-')
  const isIncomeMain = transaction.ledgerCategory === 'Income' || (transaction.ledgerCategory || '').startsWith('IncomeSplit:')
  const isCommitmentCompletion = transaction.savingsGoalId != null
  const isRewardClaim = transaction.wishlistItemId != null
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onCancel}
      maxWidthClassName="max-w-md"
      title={
        <div className="flex items-center gap-2 text-orange-500">
          <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
            <AlertCircle className="size-5" />
          </span>
          <span>Confirm Deletion</span>
        </div>
      }
      footer={
        <ModalActions>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {/* Confirming only queues the delete, so there is no busy state to show: the row's own
              RowSyncBadge carries it from here, and any attached-document deletion runs after the
              queued delete syncs. */}
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={areAttachedDocumentsLoading}
          >
            Confirm Delete
          </Button>
        </ModalActions>
      }
    >
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        {isSplitSubRecord ? (
          <p>
            This split belongs to an Income Auto-Split. Deleting it also deletes the parent and other splits.
          </p>
        ) : isIncomeMain ? (
          <p>
            This is the main Income Auto-Split record. Deleting it also deletes its category splits.
          </p>
        ) : isCommitmentCompletion ? (
          <div className="space-y-2">
            <p>
              Deleting this entry restores the amount and deadline for the commitment.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Commitment</span>
                <span className="break-words text-right min-w-0">{transaction.description}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Restore</span>
                <span className="font-bold text-foreground whitespace-nowrap">{formatSensitive(Math.abs(transaction.amount))}</span>
              </div>
            </div>
          </div>
        ) : isRewardClaim ? (
          <div className="space-y-2">
            <p>
              Deleting this entry restores the reward so it can be claimed again.
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Reward</span>
                <span className="break-words text-right min-w-0">{transaction.description}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Restore</span>
                <span className="font-bold text-foreground whitespace-nowrap">{formatSensitive(Math.abs(transaction.amount))}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p>Are you sure you want to delete this transaction?</p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Description</span>
                <span className="break-words text-right min-w-0">{transaction.description}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold text-foreground shrink-0">Amount</span>
                <span className="font-bold text-foreground whitespace-nowrap">{formatSensitive(transaction.amount)}</span>
              </div>
            </div>
          </div>
        )}
        {areAttachedDocumentsLoading && (
          <p className="rounded-lg border border-border/60 bg-muted/20 p-3 text-muted-foreground">
            Checking for attached vault documents...
          </p>
        )}
        {!areAttachedDocumentsLoading && attachedDocumentCount > 0 && (
          <div className="space-y-3 p-3 rounded-lg border border-border/60 bg-muted/20">
            <p className="font-medium text-foreground">
              {attachedDocumentCount} document{attachedDocumentCount === 1 ? '' : 's'} {attachedDocumentCount === 1 ? 'is' : 'are'} attached — {attachedDocumentCount === 1 ? 'it' : 'they'} will be kept in your Document Vault
            </p>
            <label className={`flex items-start gap-2.5 cursor-pointer ${!isOnline ? 'opacity-50' : ''}`}>
              <div className="pt-0.5 shrink-0">
                <Checkbox
                  className="accent-destructive"
                  checked={alsoDeleteDocuments}
                  onChange={e => onAlsoDeleteDocumentsChange?.(e.target.checked)}
                  disabled={!isOnline}
                />
              </div>
              <div className="space-y-1 select-none">
                <span className="font-medium text-foreground block">Also delete attached documents</span>
                {!isOnline && (
                  <span className="text-xs text-muted-foreground block">Cannot delete vault documents while offline.</span>
                )}
                {isOnline && alsoDeleteDocuments && (
                  <span className="text-xs text-orange-500/90 font-medium block">
                    The files are removed from your vault once this deletion syncs. Undo brings the
                    transaction back, but not the files.
                  </span>
                )}
              </div>
            </label>
          </div>
        )}
        <p className="text-xs text-orange-500/90 font-medium bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
          Are you sure you want to delete this transaction?
        </p>
      </div>
    </BottomSheet>
  )
}

interface EditDisabledModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onClose: () => void
}

// Shown when the user tries to edit a generated row whose invariants require delete/recreate.
export function EditDisabledModal({ isOpen, transaction, onClose }: EditDisabledModalProps) {
  if (!isOpen) return null
  const isCommitmentCompletion = transaction?.savingsGoalId != null
  const isRewardClaim = transaction?.wishlistItemId != null
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      title={
        <div className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <AlertCircle className="size-5" />
          </span>
          <span>Editing Disabled</span>
        </div>
      }
      footer={
        <ModalActions>
          <Button onClick={onClose}>
            Close
          </Button>
        </ModalActions>
      }
    >
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        {isCommitmentCompletion ? (
          <>
            <p>
              This commitment-completion entry must stay linked to its saved amount and date.
            </p>
            <p>
              Edit the commitment, then complete it again.
            </p>
          </>
        ) : isRewardClaim ? (
          <>
            <p>
              This reward-claim entry must stay linked to its saved reward, amount, account, and date.
            </p>
            <p>
              Delete it to restore the reward, then claim it again.
            </p>
          </>
        ) : (
          <>
            <p>
              This row was generated from an Income Auto-Split.
            </p>
            <p>
              Edit the main <span className="font-semibold text-foreground">Income (Auto-Split)</span> record to change its amount, description, or allocations.
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
