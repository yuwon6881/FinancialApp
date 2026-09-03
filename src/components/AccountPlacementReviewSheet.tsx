import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { LedgerAccount, RecurringPayment } from '../types'
import type { QueuedOp } from '../lib/outbox'
import type { AccountPlacementSelections } from '../lib/accountPlacementMigration'
import { BottomSheet } from './ui/BottomSheet'
import { Button } from './ui/Button'
import { CustomSelect } from './ui/CustomSelect'
import { FormField } from './ui/FormField'
import { ModalActions } from './ui/ModalActions'

const BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
type Bucket = typeof BUCKETS[number]

interface ReviewField {
  key: string
  label: string
  bucket?: Bucket
}
interface AccountPlacementReviewSheetProps {
  isOpen: boolean
  failedOps: QueuedOp[]
  accounts: LedgerAccount[]
  recurringPayments: RecurringPayment[]
  onClose: () => void
  onResolve: (operation: QueuedOp, selections: AccountPlacementSelections) => void
}

function bucket(value: unknown): Bucket | null {
  if (typeof value !== 'string') return null
  return BUCKETS.find(name => name.toLowerCase() === value.trim().toLowerCase()) ?? null
}

function fieldsFor(operation: QueuedOp, recurringPayments: RecurringPayment[]): ReviewField[] {
  const payload = operation.payload ?? {}
  const category = typeof payload.ledgerCategory === 'string' ? payload.ledgerCategory.trim() : ''
  const categoryKey = category.toLowerCase()
  if (categoryKey === 'accountmove') {
    return [
      { key: 'source', label: 'Account money leaves' },
      { key: 'destination', label: 'Account money enters' },
    ]
  }
  if (categoryKey === 'income' || categoryKey.startsWith('incomesplit:')) {
    return BUCKETS.map(name => ({ key: name, label: `${name} receiving account`, bucket: name }))
  }
  const transfer = /^transfer:([^>]+)->([^>]+)$/i.exec(category)
  if (transfer) {
    const source = bucket(transfer[1])
    const destination = bucket(transfer[2])
    if (transfer[1].trim().toLowerCase() === 'income' && destination) {
      return [{ key: destination, label: `${destination} receiving account`, bucket: destination }]
    }
    return [
      ...(source ? [{ key: source, label: `${source} source account`, bucket: source }] : []),
      ...(destination ? [{ key: destination, label: `${destination} destination account`, bucket: destination }] : []),
    ]
  }
  if (operation.entity === 'recurringPayment' && (operation.type === 'add' || operation.type === 'update')) {
    const paymentBucket = bucket(payload.ledgerCategory)
    if (paymentBucket) return [{ key: paymentBucket, label: `${paymentBucket} bill account`, bucket: paymentBucket }]
  }
  if (operation.entity === 'recurringPayment' && operation.type === 'payEarly') {
    const payment = recurringPayments.find(item => item.id === operation.targetId)
    const paymentBucket = bucket(payment?.ledgerCategory) ?? bucket(operation.needsAccountReviewBuckets?.[0])
    if (paymentBucket) return [{ key: paymentBucket, label: `${paymentBucket} bill account`, bucket: paymentBucket }]
  }
  if (operation.entity === 'recurringOccurrence' && operation.type === 'settle') {
    const recurringId = typeof payload.recurringPaymentId === 'string' ? payload.recurringPaymentId : ''
    const payment = recurringPayments.find(item => item.id === recurringId)
    const paymentBucket = bucket(payment?.ledgerCategory) ?? bucket(operation.needsAccountReviewBuckets?.[0])
    if (paymentBucket) return [{ key: paymentBucket, label: `${paymentBucket} bill account`, bucket: paymentBucket }]
  }
  if (operation.entity === 'wishlistItem' && operation.type === 'purchase') {
    return [{ key: 'Rewards', label: 'Rewards claim account', bucket: 'Rewards' }]
  }
  if (operation.entity === 'ledgerAccountReconcile' && operation.type === 'add') {
    const reconciliation = payload.reconciliation
    const reconciliationBucket = reconciliation && typeof reconciliation === 'object'
      ? bucket((reconciliation as { bucket?: unknown }).bucket)
      : null
    if (reconciliationBucket) return [{ key: reconciliationBucket, label: `${reconciliationBucket} adjustment account`, bucket: reconciliationBucket }]
  }
  return (operation.needsAccountReviewBuckets ?? [])
    .map(name => bucket(name))
    .filter((name): name is Bucket => name !== null)
    .map(name => ({ key: name, label: `${name} account`, bucket: name }))
}

export function AccountPlacementReviewSheet({
  isOpen,
  failedOps,
  accounts,
  recurringPayments,
  onClose,
  onResolve,
}: AccountPlacementReviewSheetProps) {
  const operations = useMemo(
    () => failedOps.filter(operation => operation.needsAccountReview),
    [failedOps],
  )
  const [selections, setSelections] = useState<Record<string, AccountPlacementSelections>>({})

  useEffect(() => {
    if (!isOpen) return
    setSelections(current => Object.fromEntries(
      operations.map(operation => [operation.id, current[operation.id] ?? {}]),
    ))
  }, [isOpen, operations])

  const liveAccounts = accounts.filter(account => !account.isArchived && !account.isPendingSync)

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      title="Review offline account placement"
      description="Choose the live account for each affected bucket. The original operation, date, identity and attachments stay unchanged."
      footer={(
        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} className="rounded-xl">
            Close
          </Button>
        </ModalActions>
      )}
    >
      {operations.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          <RotateCcw className="size-4" aria-hidden="true" /> No offline changes need account review.
        </div>
      ) : (
        <div className="space-y-4">
          {operations.map(operation => {
            const fields = fieldsFor(operation, recurringPayments)
            const operationSelections = selections[operation.id] ?? {}
            const complete = fields.length > 0 && fields.every(field => Boolean(operationSelections[field.key]))
            return (
              <section key={operation.id} className="space-y-3 rounded-2xl border border-border/60 bg-card/92 p-4" aria-labelledby={`account-review-${operation.id}`}>
                <div>
                  <h2 id={`account-review-${operation.id}`} className="text-sm font-bold text-foreground">
                    {operation.payload?.description || operation.payload?.name || 'Offline change'}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {operation.entity === 'transaction' ? 'Transaction' : operation.entity === 'recurringPayment' ? 'Recurring payment' : operation.entity === 'recurringOccurrence' ? 'Bill payment' : operation.entity === 'wishlistItem' ? 'Reward claim' : 'Ledger change'}
                  </p>
                </div>
                {fields.length === 0 ? (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
                    This change needs account details that cannot be inferred safely. Re-enter it after choosing the account setup.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fields.map(field => {
                      const options = liveAccounts
                        .filter(account => !field.bucket || account.bucket === field.bucket)
                        .map(account => ({ value: account.id, label: `${account.name} (${account.bucket})` }))
                      return (
                        <FormField key={field.key} label={field.label} required>
                          <CustomSelect
                            value={operationSelections[field.key] ?? ''}
                            onChange={value => setSelections(current => ({
                              ...current,
                              [operation.id]: { ...(current[operation.id] ?? {}), [field.key]: String(value) },
                            }))}
                            options={[{ value: '', label: 'Choose an account' }, ...options]}
                            ariaLabel={field.label}
                            required
                            className="w-full"
                          />
                        </FormField>
                      )
                    })}
                  </div>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!complete}
                  onClick={() => onResolve(operation, operationSelections)}
                >
                  Requeue this change
                </Button>
              </section>
            )
          })}
        </div>
      )}
    </BottomSheet>
  )
}
