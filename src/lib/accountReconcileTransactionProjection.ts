import type { Transaction } from '../types'
import { roundMoney } from './money'
import { sanitizeReconciliationOperationId } from './reconciliationOperationId'

interface ReconcileTarget {
  id?: string | null
  name?: string
  expectedCurrent?: number
  target?: number
  isArchived?: boolean
}

export function buildAccountReconcileTransactions(input: {
  operationId: string
  createdAt: number
  bucket?: string
  expectedBucketTotal?: number
  description?: string
  targets?: ReconcileTarget[]
}): Transaction[] {
  if (!input.bucket || !Array.isArray(input.targets)) return []
  const postedAt = new Date(input.createdAt).toISOString()
  const rows: Transaction[] = []
  let adjustmentIndex = 0
  for (const target of input.targets) {
    if (!target.id || typeof target.target !== 'number') continue
    const difference = roundMoney(target.target - (target.expectedCurrent ?? 0))
    if (difference === 0) continue
    rows.push({
      id: 'reconcile-' + sanitizeReconciliationOperationId(input.operationId) + '-adjustment-' + adjustmentIndex++,
      date: postedAt.slice(0, 10), postedAt,
      description: `${input.description?.trim() || 'Account balance adjustment'} - ${target.name || target.id}`,
      category: 'Adjustment', ledgerCategory: input.bucket, amount: difference,
      excludeFromAutocomplete: true, isAccountBalanceAdjustment: true,
      stabilityReloadIntent: input.bucket === 'Stability' ? 'NotRequired' : undefined,
      accountId: target.id,
    })
  }
  return rows
}
