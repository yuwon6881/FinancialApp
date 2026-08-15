import type { LedgerAccount } from '../types'

export const ACCOUNT_RECONCILIATION_EPSILON = 0.005

export interface ReconciliationAccountInput {
  id: string
  name: string
  current: number
  target: number
  isArchived: boolean
  isNew?: boolean
}

export interface NewReconciliationAccountInput {
  id: string
  name: string
  target: number
}

export interface AccountReconciliationLine extends ReconciliationAccountInput {
  diff: number
}

export interface BucketAccountReconciliation {
  bucket: LedgerAccount['bucket']
  bucketTotal: number
  currentAccountTotal: number
  targetAccountTotal: number
  bucketDifference: number
  accountAdjustmentTotal: number
  lines: AccountReconciliationLine[]
  accountAdjustments: AccountReconciliationLine[]
  isCurrentTotalTally: boolean
  isAdjustmentTally: boolean
  hasChanges: boolean
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * Builds the account split before any account rows or adjustment transactions are queued.
 * New rows start at zero. Any difference between explicit account totals and the bucket total is
 * recorded as the net of the per-account corrections; no posting account is inferred.
 */
export function calculateBucketAccountReconciliation(input: {
  bucket: LedgerAccount['bucket']
  bucketTotal: number
  existingAccounts: ReadonlyArray<ReconciliationAccountInput>
  newAccounts: ReadonlyArray<NewReconciliationAccountInput>
}): BucketAccountReconciliation {
  const bucketTotal = roundMoney(input.bucketTotal)

  const existingLines = input.existingAccounts.map(account => ({
    ...account,
    current: roundMoney(account.current),
    target: account.isArchived ? roundMoney(account.current) : roundMoney(account.target),
    diff: roundMoney((account.isArchived ? account.current : account.target) - account.current),
  }))
  const newLines = input.newAccounts.map(account => ({
      id: account.id,
      name: account.name,
      current: 0,
      target: roundMoney(account.target),
      isArchived: false,
      isNew: true,
      diff: roundMoney(account.target),
    }))
  const lines = [...existingLines, ...newLines]
  const currentAccountTotal = roundMoney(lines.reduce((sum, account) => sum + account.current, 0))
  const targetAccountTotal = roundMoney(lines.reduce((sum, account) => sum + account.target, 0))
  const bucketDifference = roundMoney(targetAccountTotal - bucketTotal)
  const accountAdjustments = lines.filter(account =>
    !account.isArchived && Math.abs(account.diff) >= ACCOUNT_RECONCILIATION_EPSILON,
  )
  const accountAdjustmentTotal = roundMoney(accountAdjustments.reduce((sum, account) => sum + account.diff, 0))

  return {
    bucket: input.bucket,
    bucketTotal,
    currentAccountTotal,
    targetAccountTotal,
    bucketDifference,
    accountAdjustmentTotal,
    lines,
    accountAdjustments,
    isCurrentTotalTally: Math.abs(currentAccountTotal - bucketTotal) < ACCOUNT_RECONCILIATION_EPSILON,
    isAdjustmentTally: Math.abs(accountAdjustmentTotal - bucketDifference) < ACCOUNT_RECONCILIATION_EPSILON,
    hasChanges: accountAdjustments.length > 0,
  }
}
