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
  isDefault: boolean
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
  unassignedBalance: number
  lines: AccountReconciliationLine[]
  accountAdjustments: AccountReconciliationLine[]
  isCurrentTotalTally: boolean
  isAdjustmentTally: boolean
  hasChanges: boolean
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * Builds the account split before any account rows or adjustment transactions are queued.
 * When a bucket has no live default, its unassigned balance will fall through to the new
 * default row after creation; modelling that here prevents the setup flow from double-counting
 * the existing bucket value.
 */
export function calculateBucketAccountReconciliation(input: {
  bucket: LedgerAccount['bucket']
  bucketTotal: number
  existingAccounts: ReadonlyArray<ReconciliationAccountInput>
  newAccounts: ReadonlyArray<NewReconciliationAccountInput>
  hasLiveDefault: boolean
}): BucketAccountReconciliation {
  const bucketTotal = roundMoney(input.bucketTotal)
  const existingTotal = roundMoney(input.existingAccounts.reduce((sum, account) => sum + account.current, 0))
  const unassignedBalance = roundMoney(bucketTotal - existingTotal)
  const newDefaultId = input.hasLiveDefault
    ? undefined
    : input.newAccounts.find(account => account.isDefault)?.id

  const existingLines = input.existingAccounts.map(account => ({
    ...account,
    current: roundMoney(account.current),
    target: account.isArchived ? roundMoney(account.current) : roundMoney(account.target),
    diff: roundMoney((account.isArchived ? account.current : account.target) - account.current),
  }))
  const newLines = input.newAccounts.map(account => {
    const current = account.id === newDefaultId ? unassignedBalance : 0
    return {
      id: account.id,
      name: account.name,
      current,
      target: roundMoney(account.target),
      isArchived: false,
      isNew: true,
      diff: roundMoney(account.target - current),
    }
  })
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
    unassignedBalance,
    lines,
    accountAdjustments,
    isCurrentTotalTally: Math.abs(currentAccountTotal - bucketTotal) < ACCOUNT_RECONCILIATION_EPSILON,
    isAdjustmentTally: Math.abs(accountAdjustmentTotal - bucketDifference) < ACCOUNT_RECONCILIATION_EPSILON,
    hasChanges: accountAdjustments.length > 0,
  }
}
