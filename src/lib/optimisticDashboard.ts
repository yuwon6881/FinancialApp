// Optimistic dashboard recompute extracted from App.tsx.
//
// Given the server's dashboard snapshot plus the outbox queues, produce a
// dashboard that already reflects the pending (not-yet-synced) mutations so the
// UI updates instantly. Settings updates are applied from the combined
// active-ops list; transaction add/update/delete adjust the running stats and
// per-category totals from the still-pending ops only. Pure so the (previously
// untested) stat arithmetic can be exercised directly.

import type { DashboardData, Transaction } from '../types'
import type { QueuedOp } from './outbox'

export interface OptimisticDashboardInputs {
  /** Combined pending + recently-completed ops (used for settings). */
  activeOps: QueuedOp[]
  /** Still-pending ops only (used for stat/category deltas). */
  pendingOps: QueuedOp[]
  /** Server transactions, for resolving the "before" amount of updates/deletes. */
  transactions: Transaction[]
}

export function computeOptimisticDashboard(
  dashboardData: DashboardData | null,
  { activeOps, pendingOps, transactions }: OptimisticDashboardInputs
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

  const txOps = pendingOps.filter(o => o.entity === 'transaction')
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
      const orig = transactions.find(t => String(t.id) === String(op.targetId))
      const oldAmount = orig ? orig.amount : 0
      const newAmount = op.payload.amount !== undefined ? op.payload.amount : oldAmount
      const diff = newAmount - oldAmount
      data.stats.totalBalance += diff
      const catName = op.payload.category || op.payload.ledgerCategory || (orig ? (orig.category || orig.ledgerCategory) : '')
      const cat = data.categories.find(c => c.name.toLowerCase() === catName.toLowerCase())
      if (cat) {
        cat.netChange += diff
        cat.remaining += diff
      }
      if (diff > 0) {
        data.stats.monthlyInflow += diff
      } else if (diff < 0) {
        data.stats.monthlyExpenses += Math.abs(diff)
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

  return data
}
