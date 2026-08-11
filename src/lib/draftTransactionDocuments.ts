import type { PendingVaultDocument, TransactionDocumentChanges } from '../types'

const DATABASE_NAME = 'financial-app-draft-files'
const DATABASE_VERSION = 1
const STORE_NAME = 'transaction-documents'

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

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local draft file storage is unavailable in this browser.'))
      return
    }

    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' })
        store.createIndex('owner', 'owner', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local draft file storage.'))
    request.onblocked = () => reject(new Error('Local draft file storage is blocked by another app window.'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local draft file storage failed.'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE_NAME, mode)
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Local draft file storage failed.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Local draft file storage was cancelled.'))
    })
    const result = await action(transaction.objectStore(STORE_NAME))
    await completed
    return result
  } finally {
    database.close()
  }
}

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
  await withStore('readwrite', async store => {
    await requestResult(store.put(record))
  })
}

export async function loadDraftTransactionDocumentChanges(
  owner: string,
  targetId: string,
): Promise<TransactionDocumentChanges> {
  if (!owner || !targetId || !globalThis.indexedDB) return { pending: [], unlinkIds: [] }
  const record = await withStore('readonly', store =>
    requestResult(store.get(recordKey(owner, targetId))) as Promise<StoredTransactionDocumentChanges | undefined>)
  return record
    ? { pending: record.pending.map(fromStoredDocument), unlinkIds: [...record.unlinkIds] }
    : { pending: [], unlinkIds: [] }
}

export async function deleteDraftTransactionDocumentChanges(owner: string, targetId: string): Promise<void> {
  if (!owner || !targetId || !globalThis.indexedDB) return
  await withStore('readwrite', async store => {
    await requestResult(store.delete(recordKey(owner, targetId)))
  })
}

export async function clearDraftTransactionDocuments(): Promise<void> {
  if (!globalThis.indexedDB) return
  await withStore('readwrite', async store => {
    await requestResult(store.clear())
  })
}
