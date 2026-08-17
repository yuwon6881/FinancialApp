import type { LedgerAccount, LedgerAccountKind } from '../types'
import type { LedgerAccountReconcileInput, LedgerAccountReconcileTarget } from './api/accounts'
import { ACCOUNT_RECONCILIATION_EPSILON } from './accountReconciliation'
import { roundMoney } from './money'
import { sanitizeReconciliationOperationId } from './reconciliationOperationId'

export interface SingleAccountCorrectionInput {
  account: LedgerAccount
  bucketAccounts: ReadonlyArray<LedgerAccount>
  nextBalance: number
  nextName?: string
  nextKind?: LedgerAccountKind
  isArchived?: boolean
  operationId?: string
}

/**
 * Builds a single-account balance reconciliation payload targeting the account's whole bucket.
 * The server validates the expected bucket total against the live sum, so all bucket accounts
 * must be included with their current balances. Only the edited account receives a changed
 * `target`; the server records the correction on that account directly.
 *
 * Returns `null` if the requested balance is unchanged within epsilon.
 */
export function buildSingleAccountCorrection(input: SingleAccountCorrectionInput): LedgerAccountReconcileInput | null {
  const currentRemaining = roundMoney(input.account.remaining)
  const targetRemaining = roundMoney(input.nextBalance)
  if (Math.abs(targetRemaining - currentRemaining) < ACCOUNT_RECONCILIATION_EPSILON) {
    return null
  }

  const bucket = input.account.bucket
  const baseAccounts = input.bucketAccounts.some(acc => acc.id === input.account.id)
    ? input.bucketAccounts
    : [...input.bucketAccounts, input.account]

  const targets: LedgerAccountReconcileTarget[] = baseAccounts.map(account => {
    const isTarget = account.id === input.account.id
    if (!isTarget) {
      return {
        id: account.id,
        name: account.name,
        bucket: account.bucket,
        kind: account.kind,
        isArchived: account.isArchived,
        expectedName: account.name,
        expectedKind: account.kind,
        expectedIsArchived: account.isArchived,
        expectedCurrent: roundMoney(account.remaining),
        target: roundMoney(account.remaining),
      }
    }

    return {
      id: account.id,
      name: input.nextName?.trim() || account.name,
      bucket: account.bucket,
      kind: input.nextKind ?? account.kind,
      isArchived: input.isArchived ?? account.isArchived,
      expectedName: account.name,
      expectedKind: account.kind,
      expectedIsArchived: account.isArchived,
      expectedCurrent: currentRemaining,
      target: targetRemaining,
    }
  })

  const expectedBucketTotal = roundMoney(targets.reduce((sum, target) => sum + target.expectedCurrent, 0))
  const cleanId = input.account.id.replace(/[^A-Za-z0-9_-]/g, '_')
  const opId = sanitizeReconciliationOperationId(
    input.operationId ?? 'balance-' + cleanId + '-' + Date.now(),
  )

  return {
    operationId: opId,
    bucket,
    expectedBucketTotal,
    targets,
  }
}
