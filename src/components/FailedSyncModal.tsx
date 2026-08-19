import { Button } from './ui/Button'
import { ModalActions } from './ui/ModalActions'
import type { QueuedOp } from '../lib/outbox'
import { BottomSheet } from './ui/BottomSheet'

interface FailedSyncModalProps {
  isOpen: boolean
  failedOps: QueuedOp[]
  onClose: () => void
  onDiscard: (id: string) => void
  onDiscardAll: () => void
  onOpenAccountReview?: () => void
}

const ENTITY_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  recurringPayment: 'Recurring payment',
  wishlistItem: 'Reward',
  category: 'Category',
  settings: 'Settings',
  investmentAccount: 'Investment account',
  investmentInstrument: 'Investment',
  investmentActivity: 'Investment activity',
  investmentCashFlow: 'Cash movement',
  investmentPlan: 'Investment plan',
  investmentAllocation: 'Investment classification',
  ledgerAccount: 'Account',
}

const TYPE_LABELS: Record<string, string> = {
  add: 'Add',
  update: 'Update',
  delete: 'Delete',
  toggle: 'Toggle',
  purchase: 'Purchase',
  restore: 'Restore',
  unpurchase: 'Undo purchase',
  reconcile: 'Reconcile',
}

function describeOp(op: QueuedOp): string {
  return op.payload?.description || op.payload?.name || ENTITY_LABELS[op.entity] || 'Item'
}

function formatFieldName(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map(item => typeof item === 'object' && item !== null ? formatFieldValue(item) : String(item)).join(', ')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('bucket' in obj && 'targets' in obj) {
      const targetCount = Array.isArray(obj.targets) ? obj.targets.length : 0
      return `${obj.bucket} (${targetCount} ${targetCount === 1 ? 'account' : 'accounts'})`
    }
    const entries = Object.entries(obj).filter(([k]) => !k.endsWith('Id') && k !== 'id' && !k.startsWith('undo'))
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${formatFieldName(k)}: ${formatFieldValue(v)}`).join(' · ')
  }
  return String(value)
}

// The queued payload holds what was sent to the server.
// Internal snapshots and identifiers are filtered out so plain language is displayed.
function getPayloadEntries(op: QueuedOp): Array<[string, unknown]> {
  if (!op.payload || typeof op.payload !== 'object') return []
  return Object.entries(op.payload).filter(([key]) => {
    if (key === 'id' || key === 'isPendingSync' || key === 'syncVersion') return false
    if (key.endsWith('Id') || key === 'undoSnapshot' || key.toLowerCase().startsWith('undo')) return false
    return true
  })
}

export function FailedSyncModal({ isOpen, failedOps, onClose, onDiscard, onDiscardAll, onOpenAccountReview }: FailedSyncModalProps) {
  if (failedOps.length === 0) return null

  const hasImmediateFailures = failedOps.some(op => op.retryCount < 5)
  const hasAccountReviews = failedOps.some(op => op.needsAccountReview)
  const failureSummary = hasAccountReviews
    ? 'Some offline changes need an explicit live account before they can be sent. Review the account setup first; the original operation and its attachments are preserved.'
    : hasImmediateFailures
    ? 'These changes were not saved and were removed from the sync queue. Permanent errors stop immediately; temporary failures retry up to five times. Discard this notice or re-enter the changes.'
    : 'These changes were not saved after five sync attempts and were removed from the queue. Discard this notice or re-enter them.'

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-base font-bold text-foreground">Failed Sync Items</span>
        </div>
      }
      footer={
        <ModalActions>
          <Button
            variant="secondary"
            onClick={onDiscardAll}
            className="rounded-xl"
          >
            Discard All
          </Button>
          <Button
            variant="primary"
            onClick={onClose}
            className="rounded-xl shadow-md"
          >
            Close
          </Button>
        </ModalActions>
      }
    >
      <div className="text-xs text-muted-foreground">
        {failureSummary}
      </div>

      <div className="space-y-3 overflow-y-auto max-h-80 pr-1 py-1 mt-2">
        {failedOps.map((op) => (
          <div key={op.id} className="p-4 rounded-xl bg-muted/30 border border-destructive/20 shadow-xs flex flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="font-bold text-foreground text-xs block truncate">{describeOp(op)}</span>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border border-border/40 bg-muted/40 text-muted-foreground">
                    {ENTITY_LABELS[op.entity] || 'Item'}
                  </span>
                  <span className="inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border border-border/40 bg-muted/40 text-muted-foreground">
                    {TYPE_LABELS[op.type] || 'Change'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {op.retryCount} {op.retryCount === 1 ? 'attempt' : 'attempts'}
                  </span>
                </div>
              </div>
            </div>
            {getPayloadEntries(op).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px] bg-muted/40 border border-border/30 rounded-lg px-2.5 py-2">
                {getPayloadEntries(op).map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <span className="text-muted-foreground font-semibold">{formatFieldName(key)}: </span>
                    <span className="text-foreground font-medium break-words">{formatFieldValue(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {op.lastError && (
              <div className="text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2.5 py-1.5 break-words">
                {op.lastError}
              </div>
            )}
            {op.needsAccountReview && onOpenAccountReview && (
              <Button variant="outline" size="sm" onClick={onOpenAccountReview}>
                Review account setup
              </Button>
            )}
            <div className="flex justify-end">
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDiscard(op.id)}
              >
                Discard
              </Button>
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
