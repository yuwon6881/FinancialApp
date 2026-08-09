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
import { getCycleRangeDates, MONTH_NAMES } from './cycle'
import { buildIncomeSplitRows, type IncomeAllocations } from './incomeSplitProjection'

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
  // A cached snapshot can predate any of these arrays — `cache.ts` replays whatever
  // shape was persisted, so a dashboard written before a field existed must still boot
  // rather than crash the whole app into the ErrorBoundary on cold launch.
  data.categories = (data.categories ?? []).map(c => ({ ...c }))
  data.activeRecurringPayments = (data.activeRecurringPayments ?? []).map(payment => ({ ...payment }))
  data.pendingNotifications = (data.pendingNotifications ?? []).map(notification => ({ ...notification }))

  const selectedMonth = MONTH_NAMES.indexOf(data.setting.selectedMonth) + 1
  const selectedRange = getCycleRangeDates(data.setting.selectedYear, selectedMonth || 1, data.setting.cycleDay)
  const selectedStart = selectedRange.start.getFullYear() + '-' + String(selectedRange.start.getMonth() + 1).padStart(2, '0') + '-' + String(selectedRange.start.getDate()).padStart(2, '0')
  const selectedEnd = selectedRange.end.getFullYear() + '-' + String(selectedRange.end.getMonth() + 1).padStart(2, '0') + '-' + String(selectedRange.end.getDate()).padStart(2, '0')
  const isInSelectedCycle = (date: unknown): date is string => typeof date === 'string' && date >= selectedStart && date <= selectedEnd
  const incomeAllocations: IncomeAllocations = {
    essentialsAlloc: data.setting.essentialsAlloc,
    growthAlloc: data.setting.growthAlloc,
    stabilityAlloc: data.setting.stabilityAlloc,
    rewardsAlloc: data.setting.rewardsAlloc,
  }
  const splitRowsFor = (transaction: Partial<Transaction> & { id: string }) =>
    buildIncomeSplitRows(transaction as Transaction, incomeAllocations)
  const persistedSplitRowsFor = (parentId: string, fallback?: Transaction) => {
    const rows = transactions.filter(transaction => transaction.id.startsWith(`${parentId}-split-`))
    return rows.length > 0 ? rows : fallback ? splitRowsFor(fallback) : []
  }
  let stabilityBalanceDelta = 0
  let recoveryTopUpDelta = 0
  const applySplitRows = (rows: Transaction[], direction: 1 | -1) => {
    rows.forEach(row => {
      const bucket = row.ledgerCategory.split('->')[1]
      const category = data.categories.find(item => item.name.toLowerCase() === bucket?.toLowerCase())
      if (category) {
        category.netChange += direction * row.amount
        category.remaining += direction * row.amount
      }
      if (bucket === 'Stability') stabilityBalanceDelta += direction * row.amount
    })
  }
  const walletSplitAmount = (rows: Transaction[]) => rows
    .filter(row => !row.ledgerCategory.endsWith('->Growth'))
    .reduce((sum, row) => sum + row.amount, 0)
  const recoveryTopUp = (transaction: {
    stabilityRecoveryTopUpAmount?: number | null
    ledgerCategory?: string
    amount?: number
  }) => {
    if (transaction.stabilityRecoveryTopUpAmount != null) {
      return Math.max(0, transaction.stabilityRecoveryTopUpAmount)
    }
    const ledgerCategory = transaction.ledgerCategory ?? ''
    const amount = transaction.amount ?? 0
    if (!(amount > 0) || !ledgerCategory.startsWith('IncomeSplit:')) return 0
    const stabilityPercent = Number(ledgerCategory.slice('IncomeSplit:'.length).split(',')[2])
    return Number.isFinite(stabilityPercent)
      ? Math.max(0, amount * (stabilityPercent / 100 - data.setting.stabilityAlloc))
      : 0
  }
  const isIncomeTransaction = (transaction: { amount?: number; ledgerCategory?: string }) =>
    (transaction.amount ?? 0) > 0
    && (transaction.ledgerCategory === 'Income'
      || transaction.ledgerCategory?.startsWith('IncomeSplit:'))

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
      const splitRows = splitRowsFor({ ...op.payload, id: String(op.targetId) } as Transaction)
      data.stats.totalBalance += splitRows.length > 0 ? walletSplitAmount(splitRows) : amount
      const catName = op.payload.category || op.payload.ledgerCategory || ''
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (splitRows.length > 0) {
        applySplitRows(splitRows, 1)
        recoveryTopUpDelta += recoveryTopUp(op.payload)
      } else if (cat) {
        cat.netChange += amount
        cat.remaining += amount
      }
      if (amount > 0) {
        data.stats.monthlyInflow += amount
        if (isIncomeTransaction(op.payload)) {
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

      const oldSplitRows = orig ? persistedSplitRowsFor(String(op.targetId), orig) : []
      const nextTransaction = { ...orig, ...op.payload, id: String(op.targetId) } as Transaction
      const newSplitRows = splitRowsFor(nextTransaction)
      if (oldSplitRows.length > 0 || newSplitRows.length > 0) {
        data.stats.totalBalance += walletSplitAmount(newSplitRows) - newAmount
          - (walletSplitAmount(oldSplitRows) - oldAmount)
      }
      applySplitRows(oldSplitRows, -1)
      applySplitRows(newSplitRows, 1)
      recoveryTopUpDelta += recoveryTopUp(nextTransaction) - recoveryTopUp(orig ?? {})

      const oldCatName = orig ? (orig.category || orig.ledgerCategory) : ''
      const oldCat = data.categories.find(c => c.name.toLowerCase() === oldCatName.toLowerCase())
      if (oldSplitRows.length === 0 && oldCat) {
        oldCat.netChange -= oldAmount
        oldCat.remaining -= oldAmount
      }
      const newCatName = op.payload.category || op.payload.ledgerCategory || oldCatName
      const newCat = data.categories.find(c => c.name.toLowerCase() === newCatName.toLowerCase())
      if (newSplitRows.length === 0 && newCat) {
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
      if (orig && isIncomeTransaction(orig)) data.stats.monthlyIncome -= oldAmount
      if (isIncomeTransaction(nextTransaction)) data.stats.monthlyIncome += newAmount
    } else if (op.type === 'delete') {
      const rawSnapshot = op.payload?.undoSnapshot ?? op.payload
      const snapshot = rawSnapshot && typeof rawSnapshot === 'object'
        ? rawSnapshot as Record<string, unknown>
        : undefined
      const orig = transactions.find(t => String(t.id) === String(op.targetId))
      const oldAmount = orig?.amount
        ?? (typeof snapshot?.amount === 'number' ? snapshot.amount : 0)
      data.stats.totalBalance -= oldAmount
      const fallback = orig ?? (snapshot ? { ...snapshot, id: String(op.targetId) } as unknown as Transaction : undefined)
      const oldSplitRows = persistedSplitRowsFor(String(op.targetId), fallback)
      if (oldSplitRows.length > 0) {
        data.stats.totalBalance -= walletSplitAmount(oldSplitRows) - oldAmount
      }
      applySplitRows(oldSplitRows, -1)
      recoveryTopUpDelta -= recoveryTopUp(fallback ?? {})
      const catName = orig
        ? (orig.category || orig.ledgerCategory)
        : typeof snapshot?.category === 'string'
          ? snapshot.category
          : typeof snapshot?.ledgerCategory === 'string' ? snapshot.ledgerCategory : ''
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (oldSplitRows.length === 0 && cat) {
        cat.netChange -= oldAmount
        cat.remaining -= oldAmount
      }
      if (oldAmount > 0) {
        data.stats.monthlyInflow -= oldAmount
      } else {
        data.stats.monthlyExpenses -= Math.abs(oldAmount)
      }
      if (fallback && isIncomeTransaction(fallback)) data.stats.monthlyIncome -= oldAmount
    }
  })

  // An accepted emergency-fund top-up rides inside a transaction's ledgerCategory rather than
  // being its own op, so without this the recovery card would keep asking for money the user has
  // already queued putting back — until the next successful refresh.
  if (data.stabilityRecovery) {
    const currentBalance = data.stabilityRecovery.currentBalance + stabilityBalanceDelta
    const outstandingShortfall = Math.max(
      0,
      data.stabilityRecovery.recoverableCeiling - currentBalance,
    )
    const toppedUpThisCycle = Math.max(
      0,
      data.stabilityRecovery.toppedUpThisCycle + recoveryTopUpDelta,
    )
    const paceAnchor = outstandingShortfall + toppedUpThisCycle
    const requiredThisCycle = data.stabilityRecovery.cyclesRemaining <= 1
      ? paceAnchor
      : Math.ceil((paceAnchor / data.stabilityRecovery.cyclesRemaining) * 100) / 100
    const outstandingThisCycle = Math.max(
      0,
      Math.min(requiredThisCycle - toppedUpThisCycle, outstandingShortfall),
    )
    data.stabilityRecovery = {
      ...data.stabilityRecovery,
      currentBalance,
      outstandingShortfall,
      requiredThisCycle,
      outstandingThisCycle,
      toppedUpThisCycle,
      isActive: outstandingShortfall > 0,
    }
    data.stats.stabilityPercentReached = data.setting.targetStabilityFund > 0
      ? Math.max(0, currentBalance / data.setting.targetStabilityFund)
      : 0
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

  const settlementOps = activeOps.filter(op => op.entity === 'recurringOccurrence' && op.type === 'settle')
  settlementOps.forEach(op => {
    const paymentId = typeof op.payload?.recurringPaymentId === 'string' ? op.payload.recurringPaymentId : ''
    const occurrenceDate = typeof op.payload?.occurrenceDate === 'string' ? op.payload.occurrenceDate : ''
    const status = op.payload?.status === 'Discarded' ? 'Discarded' : 'Paid'
    const occurrenceIndex = data.activeRecurringPayments.findIndex(payment =>
      payment.recurringPaymentId === paymentId && payment.dueDate === occurrenceDate)
    if (occurrenceIndex >= 0) {
      data.activeRecurringPayments[occurrenceIndex] = {
        ...data.activeRecurringPayments[occurrenceIndex],
        status,
        isPaid: status === 'Paid',
        isDiscarded: status === 'Discarded',
        paidDate: status === 'Paid' && typeof op.payload?.paidDate === 'string' ? op.payload.paidDate : null,
      }
    }
    data.pendingNotifications = data.pendingNotifications.filter(notification =>
      !(notification.recurringPaymentId === paymentId && notification.billingDate === occurrenceDate))

    const rawTransaction = op.isCompleted ? op.payload?.resultTransaction : op.payload?.optimisticTransaction
    if (!rawTransaction || typeof rawTransaction !== 'object') return
    const transaction = rawTransaction as Partial<Transaction>
    if (!isInSelectedCycle(transaction.date)) return
    const alreadyPresent = transactions.some(existing =>
      (transaction.id != null && String(existing.id) === String(transaction.id)) ||
      (existing.recurringPaymentId === paymentId && existing.recurringOccurrenceDate === occurrenceDate))
    if (alreadyPresent) return
    const amount = typeof transaction.amount === 'number' ? transaction.amount : 0
    data.stats.totalBalance += amount
    const category = data.categories.find(item =>
      item.name.toLowerCase() === (transaction.ledgerCategory || transaction.category || '').toLowerCase())
    if (category) {
      category.netChange += amount
      category.remaining += amount
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
