import { Button } from './ui/Button'
import type { QueuedOp } from '../lib/outbox'
import { BottomSheet } from './ui/BottomSheet'

interface FailedSyncModalProps {
  isOpen: boolean
  failedOps: QueuedOp[]
  onClose: () => void
  onDiscard: (id: string) => void
  onDiscardAll: () => void
}

const ENTITY_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  recurringPayment: 'Recurring payment',
  wishlistItem: 'Wishlist item',
  category: 'Category',
  settings: 'Settings',
  investmentAccount: 'Investment account',
  investmentInstrument: 'Investment',
  investmentActivity: 'Investment activity',
  investmentManualPrice: 'Manual price',
  investmentCashFlow: 'Cash movement',
  investmentPlan: 'Investment plan',
  investmentAllocation: 'Investment classification',
}

const TYPE_LABELS: Record<string, string> = {
  add: 'Add',
  update: 'Update',
  delete: 'Delete',
  toggle: 'Toggle',
  purchase: 'Purchase',
  restore: 'Restore',
  unpurchase: 'Undo purchase',
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
  return String(value)
}

// The queued payload already holds exactly what was being sent to the server,
// so showing it is free -- no extra data threading needed.
function getPayloadEntries(op: QueuedOp): Array<[string, unknown]> {
  if (!op.payload || typeof op.payload !== 'object') return []
  return Object.entries(op.payload).filter(([key]) => {
    if (key === 'id' || key === 'isPendingSync') return false
    if (key.endsWith('Id') || key === 'undoSnapshot') return false
    return true
  })
}

export function FailedSyncModal({ isOpen, failedOps, onClose, onDiscard, onDiscardAll }: FailedSyncModalProps) {
  if (failedOps.length === 0) return null

  const hasImmediateFailures = failedOps.some(op => op.retryCount < 5)
  const failureSummary = hasImmediateFailures
    ? "These changes couldn't be synced to the server and were removed from the active queue. Permanent client errors are stopped immediately; temporary failures are retried up to 5 times. They were never saved — discard them to clear this notice, or note them down to re-enter manually."
    : "These changes couldn't be synced to the server after 5 attempts and were removed from the active queue. They were never saved — discard them to clear this notice, or note them down to re-enter manually."

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
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button variant="unstyled"
            onClick={onDiscardAll}
            className="w-full sm:w-auto px-4 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-xl transition cursor-pointer text-center cursor-pointer"
          >
            Discard All
          </Button>
          <Button variant="unstyled"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-foreground text-background font-bold text-xs rounded-xl hover:bg-foreground/90 transition shadow-sm cursor-pointer text-center cursor-pointer"
          >
            Close
          </Button>
        </div>
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
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] bg-muted/40 border border-border/30 rounded-lg px-2.5 py-2">
                {getPayloadEntries(op).map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <span className="text-muted-foreground font-semibold">{formatFieldName(key)}: </span>
                    <span className="text-foreground font-medium break-words">{formatFieldValue(value)}</span>
                  </div>
                ))}
              </div>
            )}
            {op.lastError && (
              <div className="text-[10px] text-destructive/90 bg-destructive/5 border border-destructive/10 rounded-lg px-2.5 py-1.5 break-words">
                {op.lastError}
              </div>
            )}
            <div className="flex justify-end">
              <Button variant="unstyled"
                onClick={() => onDiscard(op.id)}
                className="px-3 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-xs rounded-lg transition duration-150 cursor-pointer border border-slate-500/10"
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
