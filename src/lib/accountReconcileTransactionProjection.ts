import type { Transaction } from '../types'

interface ReconcileTarget {
  id?: string | null
  expectedCurrent?: number
  target?: number
  isDefault?: boolean
  isArchived?: boolean
}

export function buildAccountReconcileTransactions(input: {
  operationId: string
  createdAt: number
  bucket?: string
  expectedBucketTotal?: number
  targets?: ReconcileTarget[]
}): Transaction[] {
  if (!input.bucket || !Array.isArray(input.targets)) return []
  const postedAt = new Date(input.createdAt).toISOString()
  const targetTotal = input.targets.reduce(
    (sum, target) => sum + (typeof target.target === 'number' ? target.target : 0), 0)
  const delta = Math.round((targetTotal - (input.expectedBucketTotal ?? 0)) * 100) / 100
  const defaultTarget = input.targets.find(target => target.id && target.isDefault && !target.isArchived)
  const rows: Transaction[] = []
  if (delta !== 0 && defaultTarget?.id) {
    rows.push({
      id: `reconcile-${input.operationId}-adjustment`, date: postedAt.slice(0, 10), postedAt,
      description: `Account balance adjustment - ${input.bucket}`, category: 'Adjustment',
      ledgerCategory: input.bucket, amount: delta, excludeFromAutocomplete: true, accountId: defaultTarget.id,
    })
  }

  const working = new Map(input.targets.flatMap(target => target.id
    ? [[target.id, target.expectedCurrent ?? 0] as const] : []))
  if (delta !== 0 && defaultTarget?.id) working.set(defaultTarget.id, (working.get(defaultTarget.id) ?? 0) + delta)
  const differences = input.targets.flatMap(target => target.id && typeof target.target === 'number'
    ? [{ id: target.id, difference: Math.round((target.target - (working.get(target.id) ?? 0)) * 100) / 100 }]
    : []).filter(item => item.difference !== 0)
  const sources = new Map(differences.filter(item => item.difference < 0).map(item => [item.id, item.difference]))
  let moveIndex = 0
  for (const destination of differences.filter(item => item.difference > 0)) {
    let remaining = destination.difference
    for (const sourceId of [...sources.keys()]) {
      const amount = Math.round(Math.min(remaining, Math.abs(sources.get(sourceId) ?? 0)) * 100) / 100
      if (amount <= 0) continue
      rows.push({
        id: `reconcile-${input.operationId}-move-${moveIndex++}`, date: postedAt.slice(0, 10), postedAt,
        description: 'Move between accounts', category: 'Transfer', ledgerCategory: 'AccountMove',
        amount, excludeFromAutocomplete: true, accountId: sourceId, counterAccountId: destination.id,
      })
      remaining = Math.round((remaining - amount) * 100) / 100
      sources.set(sourceId, Math.round(((sources.get(sourceId) ?? 0) + amount) * 100) / 100)
      if (remaining === 0) break
    }
  }
  return rows
}
