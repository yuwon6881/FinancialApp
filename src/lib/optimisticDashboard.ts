// Optimistic dashboard recompute extracted from App.tsx.
//
// Given the server's dashboard snapshot plus the outbox queues, produce a
// dashboard that already reflects queued mutations so the UI updates instantly.
// Pending and just-completed operations stay projected until a successful
// server refresh reconciles them; this also keeps the running stats and
// per-category totals stable through transient refresh failures. Pure so the
// arithmetic can be exercised directly.

import type { DashboardData, Transaction } from '../types'
import type { QueuedOp } from './outbox'

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
  const txOps = activeOps.filter(o => o.entity === 'transaction')
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
      const orig = transactions.find(t => String(t.id) === String(op.targetId))
      const oldAmount = orig ? orig.amount : 0
      data.stats.totalBalance -= oldAmount
      const catName = orig ? (orig.category || orig.ledgerCategory) : ''
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
