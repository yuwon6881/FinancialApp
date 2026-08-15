import type { LedgerAccount, LedgerAccountInterestFrequency, LedgerAccountKind } from '../../types'
import type { WireLedgerAccount } from '../apiTypes'
import { deobfuscateAmount, deobfuscateLedgerAccount, obfuscateAmount } from './amounts'
import { invalidateCache, jsonBody, request, requestVoid } from './client'

export interface LedgerAccountMutation {
  id?: string
  name: string
  bucket: LedgerAccount['bucket']
  kind: LedgerAccountKind
  isArchived?: boolean
  openingAmount?: number
  interestEnabled?: boolean
  interestRatePercent?: number
  interestFrequency?: LedgerAccountInterestFrequency
}

export interface LedgerAccountReconcileTarget {
  id?: string | null
  name: string
  bucket?: LedgerAccount['bucket']
  kind?: LedgerAccountKind
  isArchived: boolean
  expectedCurrent: number
  target: number
  interestEnabled?: boolean
  interestRatePercent?: number
  interestFrequency?: LedgerAccountInterestFrequency
}

export interface LedgerAccountReconcileInput {
  operationId: string
  bucket: LedgerAccount['bucket']
  expectedBucketTotal: number
  description?: string
  /** Accepted for compatibility with queued pre-change operations; new callers omit it. */
  adjustmentAccountId?: string | null
  targets: LedgerAccountReconcileTarget[]
}

export interface LedgerAccountReconcileTransaction {
  id: string
  date: string
  description: string
  category: string
  ledgerCategory: string
  amount: number
  accountId?: string | null
  counterAccountId?: string | null
  isAccountBalanceAdjustment?: boolean
  stabilityReloadIntent?: string | null
}

export interface LedgerAccountReconcileResult {
  accounts: LedgerAccount[]
  transactions: LedgerAccountReconcileTransaction[]
}

function toBody(account: LedgerAccountMutation) {
  return {
    id: account.id,
    name: account.name,
    bucket: account.bucket,
    kind: account.kind,
    isArchived: account.isArchived ?? false,
    openingAmount: obfuscateAmount(account.openingAmount ?? 0),
    interestEnabled: account.interestEnabled ?? false,
    interestRatePercent: account.interestRatePercent ?? 0,
    interestFrequency: account.interestFrequency ?? 'Monthly',
  }
}

export async function fetchLedgerAccounts(signal?: AbortSignal): Promise<LedgerAccount[]> {
  const data = await request<WireLedgerAccount[]>('/accounts', {
    signal,
    errorMessage: 'Could not load ledger accounts',
  })
  return (data || []).map(deobfuscateLedgerAccount)
}

export async function addLedgerAccount(account: LedgerAccountMutation): Promise<LedgerAccount> {
  const data = await request<WireLedgerAccount>('/accounts', {
    method: 'POST',
    ...jsonBody(toBody(account)),
    errorMessage: 'Could not add ledger account',
  })
  invalidateCache()
  return deobfuscateLedgerAccount(data)
}

export async function updateLedgerAccount(id: string, account: LedgerAccountMutation): Promise<LedgerAccount> {
  const data = await request<WireLedgerAccount>(`/accounts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    ...jsonBody(toBody({ ...account, id })),
    errorMessage: 'Could not update ledger account',
  })
  invalidateCache()
  return deobfuscateLedgerAccount(data)
}

export async function deleteLedgerAccount(id: string): Promise<void> {
  await requestVoid(`/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    errorMessage: 'Could not delete ledger account',
  })
  invalidateCache()
}

export async function reconcileLedgerAccounts(input: LedgerAccountReconcileInput): Promise<LedgerAccountReconcileResult> {
  const data = await request<{
    accounts: WireLedgerAccount[]
    transactions?: Array<Omit<LedgerAccountReconcileTransaction, 'amount'> & { amount: string | number }>
  }>('/accounts/reconcile', {
    method: 'POST',
    ...jsonBody({
      operationId: input.operationId,
      bucket: input.bucket,
      expectedBucketTotal: obfuscateAmount(input.expectedBucketTotal),
      description: input.description,
      adjustmentAccountId: input.adjustmentAccountId ?? null,
      targets: input.targets.map(target => ({
        id: target.id,
        name: target.name,
        kind: target.kind,
        isArchived: target.isArchived,
        expectedCurrent: obfuscateAmount(target.expectedCurrent),
        target: obfuscateAmount(target.target),
        interestEnabled: target.interestEnabled,
        interestRatePercent: target.interestRatePercent,
        interestFrequency: target.interestFrequency,
      })),
    }),
    errorMessage: 'Could not reconcile ledger accounts',
  })
  invalidateCache()
  return {
    accounts: (data.accounts || []).map(deobfuscateLedgerAccount),
    transactions: (data.transactions || []).map(transaction => ({
      ...transaction,
      amount: deobfuscateAmount(transaction.amount),
    })),
  }
}
