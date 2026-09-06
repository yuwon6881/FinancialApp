import type { PendingVaultDocument, TransactionDocumentChanges } from '../types'
import { DRAFT_DOCUMENTS_STORE, requestResult, withStore } from './localFileStore'

interface StoredPendingDocument {
  id: string
  blob: Blob
  name: string
  type: string
  lastModified: number
  taxYear: number
  reliefCategory: string
  amount?: number
  amountCurrency?: 'MYR' | 'OTHER'
}

interface StoredTransactionDocumentChanges {
  key: string
  owner: string
  targetId: string
  pending: StoredPendingDocument[]
  unlinkIds: number[]
  updatedAt: number
}

const recordKey = (owner: string, targetId: string) => `${owner}\u0000${targetId}`

const withDocumentStore = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>) =>
  withStore(DRAFT_DOCUMENTS_STORE, mode, action)

function toStoredDocument(document: PendingVaultDocument, index: number): StoredPendingDocument {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
    blob: document.file,
    name: document.file.name,
    type: document.file.type,
    lastModified: document.file.lastModified,
    taxYear: document.taxYear,
    reliefCategory: document.reliefCategory,
    amount: document.amount,
    amountCurrency: document.amountCurrency,
  }
}

function fromStoredDocument(document: StoredPendingDocument): PendingVaultDocument {
  return {
    file: new File([document.blob], document.name, {
      type: document.type || document.blob.type,
      lastModified: document.lastModified,
    }),
    taxYear: document.taxYear,
    reliefCategory: document.reliefCategory,
    amount: document.amount,
    amountCurrency: document.amountCurrency,
  }
}

export async function saveDraftTransactionDocumentChanges(
  owner: string,
  targetId: string,
  changes: TransactionDocumentChanges,
): Promise<void> {
  if (!owner || !targetId) throw new Error('Draft file storage needs an active account and draft.')
  if (changes.pending.length === 0 && changes.unlinkIds.length === 0) {
    await deleteDraftTransactionDocumentChanges(owner, targetId)
    return
  }

  const record: StoredTransactionDocumentChanges = {
    key: recordKey(owner, targetId),
    owner,
    targetId,
    pending: changes.pending.map(toStoredDocument),
    unlinkIds: [...new Set(changes.unlinkIds)],
    updatedAt: Date.now(),
  }
  await withDocumentStore('readwrite', async store => {
    await requestResult(store.put(record))
  })
}

export async function loadDraftTransactionDocumentChanges(
  owner: string,
  targetId: string,
): Promise<TransactionDocumentChanges> {
  if (!owner || !targetId || !globalThis.indexedDB) return { pending: [], unlinkIds: [] }
  const record = await withDocumentStore('readonly', store =>
    requestResult(store.get(recordKey(owner, targetId))) as Promise<StoredTransactionDocumentChanges | undefined>)
  return record
    ? { pending: record.pending.map(fromStoredDocument), unlinkIds: [...record.unlinkIds] }
    : { pending: [], unlinkIds: [] }
}

export async function deleteDraftTransactionDocumentChanges(owner: string, targetId: string): Promise<void> {
  if (!owner || !targetId || !globalThis.indexedDB) return
  await withDocumentStore('readwrite', async store => {
    await requestResult(store.delete(recordKey(owner, targetId)))
  })
}

export async function clearDraftTransactionDocuments(): Promise<void> {
  if (!globalThis.indexedDB) return
  await withDocumentStore('readwrite', async store => {
    await requestResult(store.clear())
  })
}
