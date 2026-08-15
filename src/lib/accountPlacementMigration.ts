import type { LedgerAccount, RecurringPayment } from '../types'
import type { OutboxPayload, QueuedOp } from './outbox'

const BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
type Bucket = typeof BUCKETS[number]

export interface AccountPlacementMigrationResult {
  pendingOps: QueuedOp[]
  failedOps: QueuedOp[]
  changed: boolean
  reviewCount: number
}

export type AccountPlacementSelections = Record<string, string>

function bucket(value: unknown): Bucket | null {
  if (typeof value !== 'string') return null
  const match = BUCKETS.find(item => item.toLowerCase() === value.trim().toLowerCase())
  return match ?? null
}

function liveAccountsByBucket(accounts: LedgerAccount[]): Map<Bucket, LedgerAccount[]> {
  const result = new Map<Bucket, LedgerAccount[]>()
  for (const name of BUCKETS) result.set(name, accounts.filter(account => account.bucket === name && !account.isArchived && !account.isPendingSync))
  return result
}

function chooseSoleAccount(accounts: Map<Bucket, LedgerAccount[]>, name: Bucket | null): string | null {
  if (!name) return null
  const rows = accounts.get(name)
  return rows?.length === 1 ? rows[0].id : null
}

function sameLiveAccount(accounts: Map<Bucket, LedgerAccount[]>, id: unknown, expectedBucket: Bucket | null): boolean {
  if (typeof id !== 'string' || !id.trim()) return false
  return Array.from(accounts.values()).some(rows => rows.some(account => account.id === id && (!expectedBucket || account.bucket === expectedBucket)))
}

function markNeedsReview(op: QueuedOp, buckets: string[]): QueuedOp {
  return {
    ...op,
    needsAccountReview: true,
    needsAccountReviewBuckets: Array.from(new Set(buckets.filter(Boolean))),
    lastError: 'Needs account: choose a live account' + (buckets.length ? ' for ' + buckets.join(', ') + '.' : '.'),
  }
}

/** Apply the account choices made in the shared failed-operation review sheet. */
export function resolveAccountPlacementOperation(
  op: QueuedOp,
  selections: AccountPlacementSelections,
): QueuedOp {
  const payload = { ...(op.payload ?? {}) }
  const category = typeof payload.ledgerCategory === 'string' ? payload.ledgerCategory.trim() : ''
  const categoryKey = category.toLowerCase()
  const selected = (name: string) => selections[name] || undefined

  if (categoryKey === 'income' || categoryKey.startsWith('incomesplit:')) {
    const splitAccountIds = payload.splitAccountIds && typeof payload.splitAccountIds === 'object'
      ? { ...payload.splitAccountIds }
      : {}
    for (const name of BUCKETS) {
      const accountId = selected(name)
      if (accountId) splitAccountIds[name] = accountId
    }
    payload.splitAccountIds = splitAccountIds
  } else if (categoryKey === 'accountmove') {
    payload.accountId = selected('source') ?? payload.accountId
    payload.counterAccountId = selected('destination') ?? payload.counterAccountId
  } else {
    const transfer = /^transfer:([^>]+)->([^>]+)$/i.exec(category)
    if (transfer && transfer[1].trim().toLowerCase() === 'income') {
      const destination = bucket(transfer[2])
      payload.accountId = destination ? (selected(destination) ?? payload.accountId) : payload.accountId
    } else if (transfer) {
      const source = bucket(transfer[1])
      const destination = bucket(transfer[2])
      payload.accountId = source ? (selected(source) ?? payload.accountId) : payload.accountId
      payload.counterAccountId = destination ? (selected(destination) ?? payload.counterAccountId) : payload.counterAccountId
    } else {
      const directBucket = bucket(category)
      if (directBucket) payload.accountId = selected(directBucket) ?? payload.accountId
    }
  }

  if (op.entity === 'recurringPayment' && (op.type === 'add' || op.type === 'update')) {
    const ledgerBucket = bucket(payload.ledgerCategory)
    if (ledgerBucket) payload.accountId = selected(ledgerBucket) ?? payload.accountId
  } else if (op.entity === 'recurringOccurrence' || (op.entity === 'recurringPayment' && op.type === 'payEarly')) {
    const accountId = Object.values(selections).find(Boolean)
    if (accountId) payload.accountId = accountId
  } else if (op.entity === 'wishlistItem' && op.type === 'purchase') {
    payload.accountId = selected('Rewards') ?? payload.accountId
  } else if (op.entity === 'ledgerAccountReconcile' && op.type === 'add') {
    const reconciliation = payload.reconciliation
    if (reconciliation && typeof reconciliation === 'object') {
      const value = reconciliation as Record<string, unknown>
      const ledgerBucket = bucket(value.bucket)
      payload.reconciliation = {
        ...value,
        adjustmentAccountId: ledgerBucket ? (selected(ledgerBucket) ?? value.adjustmentAccountId) : value.adjustmentAccountId,
      }
    }
  }

  return {
    ...op,
    payload,
    retryCount: 0,
    needsAccountReview: false,
    needsAccountReviewBuckets: undefined,
    lastError: undefined,
  }
}

function resolvePayload(
  op: QueuedOp,
  accounts: Map<Bucket, LedgerAccount[]>,
  recurringById: Map<string, RecurringPayment>,
): { payload?: OutboxPayload; reviewBuckets: string[]; relevant: boolean } {
  const payload = op.payload ? { ...op.payload } : undefined
  if (!payload) return { payload, reviewBuckets: [], relevant: false }

  if (op.entity === 'transaction' && (op.type === 'add' || op.type === 'update')) {
    const category = typeof payload.ledgerCategory === 'string' ? payload.ledgerCategory.trim() : ''
    const directBucket = bucket(category)
    if (directBucket) {
      if (sameLiveAccount(accounts, payload.accountId, directBucket)) return { payload, reviewBuckets: [], relevant: true }
      const selected = chooseSoleAccount(accounts, directBucket)
      if (selected) return { payload: { ...payload, accountId: selected }, reviewBuckets: [], relevant: true }
      return { payload, reviewBuckets: [directBucket], relevant: true }
    }

    if (category.toLowerCase() === 'income' || category.toLowerCase().startsWith('incomesplit:')) {
      const current = payload.splitAccountIds && typeof payload.splitAccountIds === 'object'
        ? { ...payload.splitAccountIds }
        : {}
      const reviewBuckets: string[] = []
      for (const name of BUCKETS) {
        if (sameLiveAccount(accounts, current[name], name)) continue
        const selected = chooseSoleAccount(accounts, name)
        if (selected) current[name] = selected
        else reviewBuckets.push(name)
      }
      return { payload: { ...payload, splitAccountIds: current }, reviewBuckets, relevant: true }
    }

    if (category.toLowerCase() === 'accountmove') {
      const validSource = sameLiveAccount(accounts, payload.accountId, null)
      const validDestination = sameLiveAccount(accounts, payload.counterAccountId, null)
      if (validSource && validDestination) return { payload, reviewBuckets: [], relevant: true }
      return { payload, reviewBuckets: ['the source and destination accounts'], relevant: true }
    }

    const transfer = /^transfer:([^>]+)->([^>]+)$/i.exec(category)
    if (transfer) {
      const sourceIsIncome = transfer[1].trim().toLowerCase() === 'income'
      const sourceBucket = bucket(transfer[1])
      const destinationBucket = bucket(transfer[2])
      const reviewBuckets: string[] = []
      let next = { ...payload }
      if (sourceIsIncome && destinationBucket) {
        if (!sameLiveAccount(accounts, next.accountId, destinationBucket)) {
          const selected = chooseSoleAccount(accounts, destinationBucket)
          if (selected) next = { ...next, accountId: selected }
          else reviewBuckets.push(destinationBucket)
        }
        return { payload: next, reviewBuckets, relevant: true }
      }
      if (sourceBucket && !sameLiveAccount(accounts, next.accountId, sourceBucket)) {
        const selected = chooseSoleAccount(accounts, sourceBucket)
        if (selected) next = { ...next, accountId: selected }
        else reviewBuckets.push(sourceBucket)
      }
      if (destinationBucket && !sameLiveAccount(accounts, next.counterAccountId, destinationBucket)) {
        const selected = chooseSoleAccount(accounts, destinationBucket)
        if (selected) next = { ...next, counterAccountId: selected }
        else reviewBuckets.push(destinationBucket)
      }
      return { payload: next, reviewBuckets, relevant: true }
    }
  }

  if (op.entity === 'recurringPayment' && (op.type === 'add' || op.type === 'update')) {
    const ledgerBucket = bucket(payload.ledgerCategory)
    if (!ledgerBucket) return { payload, reviewBuckets: [], relevant: false }
    if (sameLiveAccount(accounts, payload.accountId, ledgerBucket)) return { payload, reviewBuckets: [], relevant: true }
    const selected = chooseSoleAccount(accounts, ledgerBucket)
    return selected
      ? { payload: { ...payload, accountId: selected }, reviewBuckets: [], relevant: true }
      : { payload, reviewBuckets: [ledgerBucket], relevant: true }
  }

  if (op.entity === 'recurringOccurrence' && op.type === 'settle') {
    const recurringId = typeof payload.recurringPaymentId === 'string' ? payload.recurringPaymentId : ''
    const payment = recurringById.get(recurringId)
    const ledgerBucket = bucket(payment?.ledgerCategory)
    if (!ledgerBucket) return { payload, reviewBuckets: ['the recurring payment account'], relevant: true }
    if (sameLiveAccount(accounts, payload.accountId, ledgerBucket)) return { payload, reviewBuckets: [], relevant: true }
    if (payment && sameLiveAccount(accounts, payment.accountId, ledgerBucket)) {
      return { payload: { ...payload, accountId: payment.accountId }, reviewBuckets: [], relevant: true }
    }
    const selected = chooseSoleAccount(accounts, ledgerBucket)
    return selected
      ? { payload: { ...payload, accountId: selected }, reviewBuckets: [], relevant: true }
      : { payload, reviewBuckets: [ledgerBucket], relevant: true }
  }

  if (op.entity === 'recurringPayment' && op.type === 'payEarly') {
    const payment = recurringById.get(String(op.targetId))
    const ledgerBucket = bucket(payment?.ledgerCategory)
    if (!ledgerBucket) return { payload, reviewBuckets: ['the recurring payment account'], relevant: true }
    if (sameLiveAccount(accounts, payload.accountId, ledgerBucket)) return { payload, reviewBuckets: [], relevant: true }
    if (payment && sameLiveAccount(accounts, payment.accountId, ledgerBucket)) {
      return { payload: { ...payload, accountId: payment.accountId }, reviewBuckets: [], relevant: true }
    }
    const selected = chooseSoleAccount(accounts, ledgerBucket)
    return selected
      ? { payload: { ...payload, accountId: selected }, reviewBuckets: [], relevant: true }
      : { payload, reviewBuckets: [ledgerBucket], relevant: true }
  }

  if (op.entity === 'wishlistItem' && op.type === 'purchase') {
    if (sameLiveAccount(accounts, payload.accountId, 'Rewards')) return { payload, reviewBuckets: [], relevant: true }
    const selected = chooseSoleAccount(accounts, 'Rewards')
    return selected
      ? { payload: { ...payload, accountId: selected }, reviewBuckets: [], relevant: true }
      : { payload, reviewBuckets: ['Rewards'], relevant: true }
  }

  if (op.entity === 'ledgerAccountReconcile' && op.type === 'add') {
    const reconciliation = payload.reconciliation
    if (!reconciliation || typeof reconciliation !== 'object') return { payload, reviewBuckets: [], relevant: false }
    const value = reconciliation as { bucket?: unknown; targets?: unknown; expectedBucketTotal?: unknown; adjustmentAccountId?: unknown }
    const ledgerBucket = bucket(value.bucket)
    const targets = Array.isArray(value.targets) ? value.targets : []
    const expectedBucketTotal = typeof value.expectedBucketTotal === 'number' ? value.expectedBucketTotal : null
    const targetTotal = targets.reduce((sum, target) => {
      if (!target || typeof target !== 'object') return sum
      const row = target as { target?: unknown }
      return sum + (typeof row.target === 'number' ? row.target : 0)
    }, 0)
    const needsCorrection = ledgerBucket !== null && (expectedBucketTotal !== null
      ? Math.abs(targetTotal - expectedBucketTotal) >= 0.005
      : targets.some(target => {
        if (!target || typeof target !== 'object') return false
        const row = target as { expectedCurrent?: unknown; target?: unknown }
        return typeof row.expectedCurrent === 'number' && typeof row.target === 'number' && Math.abs(row.expectedCurrent - row.target) >= 0.005
      }))
    if (!needsCorrection || !ledgerBucket) return { payload, reviewBuckets: [], relevant: false }
    if (sameLiveAccount(accounts, value.adjustmentAccountId, ledgerBucket)) return { payload, reviewBuckets: [], relevant: true }
    const selected = chooseSoleAccount(accounts, ledgerBucket)
    return selected
      ? { payload: { ...payload, reconciliation: { ...value, adjustmentAccountId: selected } }, reviewBuckets: [], relevant: true }
      : { payload, reviewBuckets: [ledgerBucket], relevant: true }
  }

  return { payload, reviewBuckets: [], relevant: false }
}

function migrateOne(
  op: QueuedOp,
  accounts: Map<Bucket, LedgerAccount[]>,
  recurringById: Map<string, RecurringPayment>,
): { op: QueuedOp; review: boolean; resolved: boolean } {
  const resolved = resolvePayload(op, accounts, recurringById)
  if (!resolved.relevant) return { op, review: false, resolved: false }
  if (resolved.reviewBuckets.length > 0) return { op: markNeedsReview(op, resolved.reviewBuckets), review: true, resolved: false }
  return {
    op: {
      ...op,
      payload: resolved.payload,
      needsAccountReview: false,
      needsAccountReviewBuckets: undefined,
      lastError: op.needsAccountReview ? undefined : op.lastError,
    },
    review: false,
    resolved: true,
  }
}

export function migrateAccountPlacementOperations(
  pendingOps: QueuedOp[],
  failedOps: QueuedOp[],
  accounts: LedgerAccount[],
  recurringPayments: RecurringPayment[] = [],
): AccountPlacementMigrationResult {
  const accountMap = liveAccountsByBucket(accounts)
  const recurringById = new Map(recurringPayments.map(payment => [String(payment.id), payment]))
  const nextPending: QueuedOp[] = []
  const nextFailed = [...failedOps]
  let changed = false
  let reviewCount = 0

  for (const op of pendingOps) {
    const migrated = migrateOne(op, accountMap, recurringById)
    if (!migrated.review && migrated.resolved) {
      nextPending.push(migrated.op)
      changed ||= JSON.stringify(migrated.op) !== JSON.stringify(op)
      continue
    }
    if (migrated.review) {
      nextFailed.push(migrated.op)
      changed = true
      reviewCount += 1
      continue
    }
    nextPending.push(op)
  }

  for (let index = nextFailed.length - 1; index >= 0; index -= 1) {
    const op = nextFailed[index]
    // Only ops this migration itself blocked may go back to the queue. Every other failed op is
    // there because the *server* refused it, and a refusal is not fixed by re-checking placement:
    // requeueing one dispatched it again, it failed again, and the round trip flipped the accounts'
    // isPendingSync -- which this effect's own signature reads -- so the pair spun indefinitely.
    if (!op.needsAccountReview) continue
    const migrated = migrateOne(op, accountMap, recurringById)
    if (migrated.resolved) {
      nextFailed.splice(index, 1)
      nextPending.push(migrated.op)
      changed = true
    } else if (migrated.review) {
      nextFailed[index] = migrated.op
      if (JSON.stringify(migrated.op) !== JSON.stringify(op)) changed = true
      reviewCount += 1
    }
  }

  return { pendingOps: nextPending, failedOps: nextFailed, changed, reviewCount }
}
