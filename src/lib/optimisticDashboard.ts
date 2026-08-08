// Optimistic dashboard recompute extracted from App.tsx.
//
// Given the server's dashboard snapshot plus the outbox queues, produce a
// dashboard that already reflects queued mutations so the UI updates instantly.
// Pending and just-completed operations stay projected until a successful
// server refresh reconciles them; this also keeps the running stats and
// per-category totals stable through transient refresh failures. Pure so the
// arithmetic can be exercised directly.

import type { DashboardData, Transaction } from '../types'
import { expandBulkTransactionProjection, type QueuedOp } from './outbox'

export interface OptimisticDashboardInputs {
  /** Combined pending + recently-completed ops awaiting server reconciliation. */
  activeOps: QueuedOp[]
  /** Server transactions, for resolving the "before" amount of updates/deletes. */
  transactions: Transaction[]
}

export function computeOptimisticDashboard(
  dashboardData: DashboardData | null,
  { activeOps, transactions }: OptimisticDashboardInputs
): DashboardData | null {
  if (!dashboardData) return null

  const data = { ...dashboardData }
  data.setting = { ...data.setting }
  data.stats = { ...data.stats }
  data.categories = data.categories.map(c => ({ ...c }))

  // Check if settings op queued
  const settingsOps = activeOps.filter(o => o.entity === 'settings' && o.type === 'update')
  settingsOps.forEach(op => {
    if (op.payload) {
      data.setting = { ...data.setting, ...op.payload }
    }
  })

  // Completed mutations stay in activeOps until a successful server refresh.
  // Applying that retained projection prevents dashboard totals from snapping
  // back when the mutation succeeded but reconciliation temporarily failed.
  const txOps = expandBulkTransactionProjection(activeOps.filter(o => o.entity === 'transaction'))
  txOps.forEach(op => {
    if (op.type === 'add' && op.payload) {
      const amount = op.payload.amount || 0
      data.stats.totalBalance += amount
      const catName = op.payload.category || op.payload.ledgerCategory || ''
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (cat) {
        cat.netChange += amount
        cat.remaining += amount
      }
      if (amount > 0) {
        data.stats.monthlyInflow += amount
        if ((op.payload.ledgerCategory || '').startsWith('IncomeSplit:')) {
          data.stats.monthlyIncome += amount
        }
      } else {
        data.stats.monthlyExpenses += Math.abs(amount)
      }
    } else if (op.type === 'update' && op.payload) {
      // Model an update as "remove the original, add the new value". Applying only the
      // net delta to the new category (as before) left the old category untouched when
      // the category changed, and classified inflow/expense by the sign of the delta —
      // so reducing an inflow (or expense) landed in the wrong bucket. Removing each
      // side by its own sign/category keeps every bucket correct in all cases.
      const orig = transactions.find(t => String(t.id) === String(op.targetId))
      const oldAmount = orig ? orig.amount : 0
      const newAmount = op.payload.amount !== undefined ? op.payload.amount : oldAmount
      data.stats.totalBalance += newAmount - oldAmount

      const oldCatName = orig ? (orig.category || orig.ledgerCategory) : ''
      const oldCat = data.categories.find(c => c.name.toLowerCase() === oldCatName.toLowerCase())
      if (oldCat) {
        oldCat.netChange -= oldAmount
        oldCat.remaining -= oldAmount
      }
      const newCatName = op.payload.category || op.payload.ledgerCategory || oldCatName
      const newCat = data.categories.find(c => c.name.toLowerCase() === newCatName.toLowerCase())
      if (newCat) {
        newCat.netChange += newAmount
        newCat.remaining += newAmount
      }

      if (oldAmount > 0) {
        data.stats.monthlyInflow -= oldAmount
      } else {
        data.stats.monthlyExpenses -= Math.abs(oldAmount)
      }
      if (newAmount > 0) {
        data.stats.monthlyInflow += newAmount
      } else {
        data.stats.monthlyExpenses += Math.abs(newAmount)
      }
    } else if (op.type === 'delete') {
      const rawSnapshot = op.payload?.undoSnapshot ?? op.payload
      const snapshot = rawSnapshot && typeof rawSnapshot === 'object'
        ? rawSnapshot as Record<string, unknown>
        : undefined
      const orig = transactions.find(t => String(t.id) === String(op.targetId))
      const oldAmount = orig?.amount
        ?? (typeof snapshot?.amount === 'number' ? snapshot.amount : 0)
      data.stats.totalBalance -= oldAmount
      const catName = orig
        ? (orig.category || orig.ledgerCategory)
        : typeof snapshot?.category === 'string'
          ? snapshot.category
          : typeof snapshot?.ledgerCategory === 'string' ? snapshot.ledgerCategory : ''
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (cat) {
        cat.netChange -= oldAmount
        cat.remaining -= oldAmount
      }
      if (oldAmount > 0) {
        data.stats.monthlyInflow -= oldAmount
      } else {
        data.stats.monthlyExpenses -= Math.abs(oldAmount)
      }
    }
  })

  // An accepted emergency-fund top-up rides inside a transaction's ledgerCategory rather than
  // being its own op, so without this the recovery card would keep asking for money the user has
  // already queued putting back — until the next successful refresh.
  if (data.stabilityRecovery) {
    const stabilityAlloc = data.setting.stabilityAlloc || 0
    const queuedTopUp = txOps.reduce((total, op) => {
      if (op.type !== 'add' || !op.payload) return total
      const ledgerCategory: string = op.payload.ledgerCategory || ''
      if (!ledgerCategory.startsWith('IncomeSplit:')) return total
      const amount = op.payload.amount || 0
      if (amount <= 0) return total
      const stabilityPercent = Number(ledgerCategory.slice('IncomeSplit:'.length).split(',')[2])
      if (!Number.isFinite(stabilityPercent)) return total
      // Only credit above what the plain percentage would have delivered counts as putting money
      // back; the usual share was never part of the ask.
      return total + Math.max(0, amount * (stabilityPercent / 100) - amount * stabilityAlloc)
    }, 0)

    if (queuedTopUp > 0) {
      const outstandingShortfall = Math.max(0, data.stabilityRecovery.outstandingShortfall - queuedTopUp)
      data.stabilityRecovery = {
        ...data.stabilityRecovery,
        outstandingShortfall,
        outstandingThisCycle: Math.max(0, data.stabilityRecovery.outstandingThisCycle - queuedTopUp),
        toppedUpThisCycle: data.stabilityRecovery.toppedUpThisCycle + queuedTopUp,
        isActive: outstandingShortfall > 0,
      }
    }
  }

  // Pay-early is queued under its recurring-payment target but creates a ledger row. Project the
  // row into the dashboard until the normal bootstrap refresh reconciles it, including after a
  // successful POST whose refresh briefly fails. Avoid double-counting a row already present in
  // the server snapshot (for example when a refresh raced the outbox completion).
  const payEarlyOps = activeOps.filter(o => o.entity === 'recurringPayment' && o.type === 'payEarly')
  payEarlyOps.forEach(op => {
    const rawTransaction = op.payload?.resultTransaction ?? op.payload?.optimisticTransaction
    if (!rawTransaction || typeof rawTransaction !== 'object') return
    const transaction = rawTransaction as Partial<Transaction>
    const alreadyPresent = transactions.some(existing =>
      (transaction.id != null && String(existing.id) === String(transaction.id)) ||
      (transaction.recurringPaymentId != null && transaction.recurringOccurrenceDate != null &&
        String(existing.recurringPaymentId) === String(transaction.recurringPaymentId) &&
        existing.recurringOccurrenceDate === transaction.recurringOccurrenceDate)
    )
    if (alreadyPresent) return

    const amount = typeof transaction.amount === 'number' ? transaction.amount : 0
    data.stats.totalBalance += amount
    const catName = transaction.category || transaction.ledgerCategory || ''
    const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
    if (cat) {
      cat.netChange += amount
      cat.remaining += amount
    }
    if (amount > 0) data.stats.monthlyInflow += amount
    else data.stats.monthlyExpenses += Math.abs(amount)
  })

  const wishlistPurchaseOps = activeOps.filter(o => o.entity === 'wishlistItem' && (o.type === 'purchase' || o.type === 'unpurchase'))
  wishlistPurchaseOps.forEach(op => {
    if (op.type === 'purchase' && op.payload) {
      const price = Number(op.payload.price || 0)
      if (price > 0) {
        const amount = -price
        data.stats.totalBalance += amount
        data.stats.monthlyExpenses += price
        const rewardsCat = data.categories.find(c => c.name.toLowerCase() === 'rewards')
        if (rewardsCat) {
          rewardsCat.netChange += amount
          rewardsCat.remaining += amount
        }
      }
    } else if (op.type === 'unpurchase' && op.payload) {
      const origTx = transactions.find(t => String(t.id) === String(op.payload?.purchaseTransactionId))
      if (origTx) {
        const amount = origTx.amount
        data.stats.totalBalance -= amount
        if (amount < 0) {
          data.stats.monthlyExpenses -= Math.abs(amount)
        }
        const rewardsCat = data.categories.find(c => c.name.toLowerCase() === 'rewards')
        if (rewardsCat) {
          rewardsCat.netChange -= amount
          rewardsCat.remaining -= amount
        }
      }
    }
  })

  return data
}
