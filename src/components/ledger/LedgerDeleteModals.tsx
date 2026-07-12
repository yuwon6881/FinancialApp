import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Transaction } from '../../types'
import { BottomSheet } from '../ui/BottomSheet'

interface DeleteTransactionModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onCancel: () => void
  onConfirm: () => void
  formatSensitive: (val: number) => ReactNode
}

// Confirm-deletion bottom sheet. Explains the cascade for Income Auto-Split
// main records and their split sub-records.
export function DeleteTransactionModal({
  isOpen,
  transaction,
  onCancel,
  onConfirm,
  formatSensitive,
}: DeleteTransactionModalProps) {
  if (!isOpen || !transaction) return null
  const isSplitSubRecord = transaction.id.includes('-split-')
  const isIncomeMain = transaction.ledgerCategory === 'Income' || (transaction.ledgerCategory || '').startsWith('IncomeSplit:')
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
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted text-foreground transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            Confirm Delete
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        {isSplitSubRecord ? (
          <p>
            This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> of an Income Auto-Split. Deleting it will delete the main Income record and all other category splits associated with it.
          </p>
        ) : isIncomeMain ? (
          <p>
            This is the <span className="font-semibold text-foreground">main Income Auto-Split record</span>. Deleting it will delete all its associated category sub-split records as well.
          </p>
        ) : (
          <p className="flex flex-wrap items-baseline gap-x-1">
            <span>Are you sure you want to delete this transaction:</span> <span className="font-semibold text-foreground break-words">"{transaction.description}"</span> <span>of</span> <span className="font-bold text-foreground whitespace-nowrap">{formatSensitive(transaction.amount)}</span><span>?</span>
          </p>
        )}
        <p className="text-[10px] text-orange-500/90 font-medium bg-orange-500/5 p-2 rounded-lg border border-orange-500/10">
          Are you sure you want to delete this transaction?
        </p>
      </div>
    </BottomSheet>
  )
}

interface EditDisabledModalProps {
  isOpen: boolean
  onClose: () => void
}

// Shown when the user tries to edit an auto-generated split sub-record.
export function EditDisabledModal({ isOpen, onClose }: EditDisabledModalProps) {
  if (!isOpen) return null
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
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          This transaction is a <span className="font-semibold text-foreground">split transfer sub-record</span> generated automatically from an Income Auto-Split.
        </p>
        <p>
          To edit this transaction's amount, description, or split allocations, please find and edit the main <span className="font-semibold text-foreground">Income (Auto-Split)</span> record.
        </p>
      </div>
    </BottomSheet>
  )
}
