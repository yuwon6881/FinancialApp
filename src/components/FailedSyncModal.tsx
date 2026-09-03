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
  onRetry?: (id: string) => void
  onOpenAccountReview?: () => void
}

const ENTITY_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  recurringPayment: 'Recurring payment',
  recurringOccurrence: 'Bill occurrence',
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
  savingsGoal: 'Savings goal',
  loan: 'Loan',
  vaultDocument: 'Document',
  taxReliefCategory: 'Tax relief',
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
  settle: 'Settle',
  payEarly: 'Pay early',
  advanceRepayment: 'Advance repayment',
  fullSettlement: 'Full settlement',
  undoRepayment: 'Undo repayment',
}

function describeOp(op: QueuedOp): string {
  return op.payload?.description || op.payload?.name || ENTITY_LABELS[op.entity] || 'Item'
}

// Keys that are always suppressed — internal sync/projection artifacts, identifiers,
// undo snapshots, and fields already shown in the card header.
const SUPPRESSED_KEYS = new Set([
  'id', 'isPendingSync', 'syncVersion',
  'undoSnapshot', 'undoReconciliation',
  'optimisticTransaction', 'resultTransaction',
  'actions', 'beforeSnapshots', 'transactions', 'transactionIds', 'moves',
  'name', 'description',
  // Scheduling metadata shown via curated fields or irrelevant to the user
  'optimisticNextOccurrenceDate', 'settledOccurrenceDate',
  'purchaseTransactionId', 'replacementCategoryId',
  'insertFallbackPayload',
])

function isSuppressedKey(key: string): boolean {
  if (SUPPRESSED_KEYS.has(key)) return true
  if (key.endsWith('Id') && key !== 'accountId') return true
  if (key.toLowerCase().startsWith('undo')) return true
  return false
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

/** Renders a date-like string as a short human-readable date (e.g. "28 Aug 2026"). */
function formatDateValue(value: string): string {
  // Accept YYYY-MM-DD and full ISO timestamps
  const dateStr = value.length > 10 ? value : `${value}T12:00:00`
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const DATE_KEYS = new Set([
  'date', 'paidDate', 'occurrenceDate', 'nextOccurrenceDate',
  'postedAt', 'createdAt', 'purchasedAt', 'trackingStartDate',
  'scheduleStartDate',
])

function isDateKey(key: string): boolean {
  return DATE_KEYS.has(key)
}

function formatFieldName(key: string): string {
  const LABEL_MAP: Record<string, string> = {
    amount: 'Amount',
    date: 'Date',
    paidDate: 'Paid',
    occurrenceDate: 'Due date',
    nextOccurrenceDate: 'Next due',
    status: 'Status',
    category: 'Category',
    ledgerCategory: 'Bucket',
    postedAt: 'Posted',
    paymentMode: 'Payment',
    scheduleFrequency: 'Frequency',
    scheduleStatus: 'Schedule',
    active: 'Active',
    price: 'Price',
    currency: 'Currency',
    type: 'Type',
    kind: 'Kind',
    bucket: 'Bucket',
    openingPrincipal: 'Opening principal',
    annualRatePercent: 'Annual rate',
    termPeriods: 'Term periods',
    interestMethod: 'Interest method',
  }
  if (LABEL_MAP[key]) return LABEL_MAP[key]
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') {
    if (key === 'annualRatePercent') return `${value}%`
    return String(value)
  }
  if (typeof value === 'string') {
    if (isDateKey(key)) return formatDateValue(value)
    return value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map(item => typeof item === 'object' && item !== null ? formatFieldValue(key, item) : String(item)).join(', ')
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('bucket' in obj && 'targets' in obj) {
      const targetCount = Array.isArray(obj.targets) ? obj.targets.length : 0
      return `${obj.bucket} (${targetCount} ${targetCount === 1 ? 'account' : 'accounts'})`
    }
    const entries = Object.entries(obj).filter(([k]) => !k.endsWith('Id') && k !== 'id' && !k.startsWith('undo'))
    if (entries.length === 0) return '—'
    return entries.map(([k, v]) => `${formatFieldName(k)}: ${formatFieldValue(k, v)}`).join(', ')
  }
  return String(value)
}

// ---------------------------------------------------------------------------
// Entity-aware curated fields — show only what matters per entity type
// ---------------------------------------------------------------------------

interface StatField {
  label: string
  value: string
  /** 'status' uses status-badge styling; undefined renders as plain bold text. */
  tone?: 'status'
}

/** Status value → badge styling class */
function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'paid' || s === 'paid off' || s === 'settledbyloanpayoff') return 'bg-emerald-500/15 text-emerald-500'
  if (s === 'part paid' || s === 'partiallypaid') return 'bg-blue-500/15 text-blue-500'
  if (s === 'discarded') return 'bg-muted text-muted-foreground'
  return 'bg-amber-500/15 text-amber-500'
}

function statusLabel(status: string): string {
  if (status === 'PartiallyPaid') return 'Part paid'
  if (status === 'SettledByLoanPayoff') return 'Paid off'
  return status
}

function getCuratedFields(op: QueuedOp): StatField[] | null {
  const p = op.payload
  if (!p) return null

  if (op.entity === 'recurringPayment' || op.entity === 'recurringOccurrence') {
    const fields: StatField[] = []
    if (p.amount != null) fields.push({ label: 'Amount', value: String(Math.abs(p.amount)) })
    if (p.occurrenceDate) fields.push({ label: 'Due date', value: formatDateValue(String(p.occurrenceDate)) })
    if (p.paidDate) fields.push({ label: 'Paid', value: formatDateValue(String(p.paidDate)) })
    else if (p.date) fields.push({ label: 'Date', value: formatDateValue(String(p.date)) })
    if (typeof p.status === 'string') fields.push({ label: 'Status', value: statusLabel(p.status), tone: 'status' })
    if (p.category) fields.push({ label: 'Category', value: String(p.category) })
    if (p.ledgerCategory) fields.push({ label: 'Bucket', value: String(p.ledgerCategory) })
    if (p.nextOccurrenceDate) fields.push({ label: 'Next due', value: formatDateValue(String(p.nextOccurrenceDate)) })
    return fields.length > 0 ? fields : null
  }

  if (op.entity === 'transaction') {
    const fields: StatField[] = []
    if (p.amount != null) fields.push({ label: 'Amount', value: String(p.amount) })
    if (p.date) fields.push({ label: 'Date', value: formatDateValue(String(p.date)) })
    if (p.category) fields.push({ label: 'Category', value: String(p.category) })
    if (p.ledgerCategory) fields.push({ label: 'Bucket', value: String(p.ledgerCategory) })
    return fields.length > 0 ? fields : null
  }

  if (op.entity === 'investmentCashFlow' || op.entity === 'investmentActivity') {
    const fields: StatField[] = []
    if (p.amount != null) fields.push({ label: 'Amount', value: String(p.amount) })
    if (p.currency) fields.push({ label: 'Currency', value: String(p.currency) })
    if (p.date) fields.push({ label: 'Date', value: formatDateValue(String(p.date)) })
    if (p.type) fields.push({ label: 'Type', value: String(p.type) })
    return fields.length > 0 ? fields : null
  }

  if (op.entity === 'loan') {
    const fields: StatField[] = []
    if (p.openingPrincipal != null) fields.push({ label: 'Principal', value: String(p.openingPrincipal) })
    if (p.annualRatePercent != null) fields.push({ label: 'Rate', value: `${p.annualRatePercent}%` })
    if (p.termPeriods != null) fields.push({ label: 'Term', value: `${p.termPeriods} periods` })
    if (p.trackingStartDate) fields.push({ label: 'Start date', value: formatDateValue(String(p.trackingStartDate)) })
    return fields.length > 0 ? fields : null
  }

  if (op.entity === 'wishlistItem') {
    const fields: StatField[] = []
    if (p.price != null) fields.push({ label: 'Price', value: String(p.price) })
    if (p.category) fields.push({ label: 'Category', value: String(p.category) })
    if (p.purchasedAt) fields.push({ label: 'Purchased', value: formatDateValue(String(p.purchasedAt)) })
    return fields.length > 0 ? fields : null
  }

  // No curated view — fall back to generic display
  return null
}

// The queued payload holds what was sent to the server.
// Internal snapshots and identifiers are filtered out so plain language is displayed.
function getPayloadEntries(op: QueuedOp): Array<[string, unknown]> {
  if (!op.payload || typeof op.payload !== 'object') return []
  return Object.entries(op.payload).filter(([key]) => !isSuppressedKey(key))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FailedSyncModal({ isOpen, failedOps, onClose, onDiscard, onDiscardAll, onRetry, onOpenAccountReview }: FailedSyncModalProps) {
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
      <div className="text-xs text-muted-foreground leading-relaxed">
        {failureSummary}
      </div>

      <div className="space-y-3 overflow-y-auto max-h-80 pr-1 py-1 mt-2">
        {failedOps.map((op) => {
          const curatedFields = getCuratedFields(op)
          return (
            <div key={op.id} className="rounded-xl bg-muted/30 border border-destructive/20 shadow-xs flex flex-col gap-3 overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-4 pt-3">
                <div className="min-w-0">
                  <span className="font-bold text-foreground text-sm block truncate">{describeOp(op)}</span>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-block text-xs px-1.5 py-0.5 font-bold rounded border border-border/40 bg-muted/40 text-muted-foreground">
                      {ENTITY_LABELS[op.entity] || 'Item'}
                    </span>
                    <span className="inline-block text-xs px-1.5 py-0.5 font-bold rounded border border-border/40 bg-muted/40 text-muted-foreground">
                      {TYPE_LABELS[op.type] || 'Change'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {op.retryCount} {op.retryCount === 1 ? 'attempt' : 'attempts'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Curated stat-card grid for known entity types */}
              {curatedFields !== null && curatedFields.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 mx-4 p-3 bg-muted/30 border border-border/40 rounded-xl">
                  {curatedFields.map((field) => (
                    <div key={field.label} className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-muted-foreground font-normal uppercase tracking-wider">{field.label}</span>
                      {field.tone === 'status' ? (
                        <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-xs font-bold leading-none ${statusBadgeClass(field.value)}`}>
                          {field.value}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-foreground break-words leading-tight">{field.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Generic fallback for uncurated entity types */}
              {curatedFields === null && getPayloadEntries(op).length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 mx-4 p-3 bg-muted/30 border border-border/40 rounded-xl">
                  {getPayloadEntries(op).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-muted-foreground font-normal uppercase tracking-wider">{formatFieldName(key)}</span>
                      <span className="text-sm font-bold text-foreground break-words leading-tight">{formatFieldValue(key, value)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error + actions */}
              <div className="flex flex-col gap-2 px-4 pb-3">
                {op.lastError && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2.5 py-1.5 break-words">
                    {op.lastError}
                  </div>
                )}
                {op.needsAccountReview && onOpenAccountReview && (
                  <Button variant="secondary" size="sm" onClick={onOpenAccountReview} className="w-full">
                    Review account setup
                  </Button>
                )}
                <div className="flex justify-end gap-2">
                  {!op.needsAccountReview && onRetry && (
                    <Button variant="secondary" size="sm" onClick={() => onRetry(op.id)}>
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDiscard(op.id)}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}
