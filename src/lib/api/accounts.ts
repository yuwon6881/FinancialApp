import type { LedgerAccount, LedgerAccountKind } from '../../types'
import type { WireLedgerAccount } from '../apiTypes'
import { deobfuscateLedgerAccount, obfuscateAmount } from './amounts'
import { invalidateCache, jsonBody, request, requestVoid } from './client'

export interface LedgerAccountMutation {
  id?: string
  name: string
  bucket: LedgerAccount['bucket']
  kind: LedgerAccountKind
  isArchived?: boolean
  isDefault?: boolean
  openingAmount?: number
}

function toBody(account: LedgerAccountMutation) {
  return {
    id: account.id,
    name: account.name,
    bucket: account.bucket,
    kind: account.kind,
    isArchived: account.isArchived ?? false,
    isDefault: account.isDefault ?? false,
    openingAmount: obfuscateAmount(account.openingAmount ?? 0),
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
