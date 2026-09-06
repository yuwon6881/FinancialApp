/**
 * The one IndexedDB database holding binary work that must outlive a page: files attached to a
 * draft transaction, and images picked for a scan that has not finished uploading yet.
 *
 * Both are the same kind of promise — bytes the user handed us that no server has yet — so they
 * share a database and this plumbing rather than each hand-rolling `open`/`transaction`/`onerror`.
 * Callers decide their own failure policy: draft files surface storage errors, because losing an
 * attachment silently is worse than a warning, while the scan queue treats storage as best-effort
 * and falls back to a plain upload.
 */

const DATABASE_NAME = 'financial-app-draft-files'
// v2 added the scan-upload queue. Upgrades only ever create missing stores, so an existing
// database keeps every draft file already in it.
const DATABASE_VERSION = 2

export const DRAFT_DOCUMENTS_STORE = 'transaction-documents'
export const SCAN_UPLOADS_STORE = 'scan-uploads'

export function hasLocalFileStorage(): boolean {
  return Boolean(globalThis.indexedDB)
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local draft file storage is unavailable in this browser.'))
      return
    }

    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DRAFT_DOCUMENTS_STORE)) {
        const store = database.createObjectStore(DRAFT_DOCUMENTS_STORE, { keyPath: 'key' })
        store.createIndex('owner', 'owner', { unique: false })
      }
      if (!database.objectStoreNames.contains(SCAN_UPLOADS_STORE)) {
        database.createObjectStore(SCAN_UPLOADS_STORE, { keyPath: 'uploadId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local draft file storage.'))
    request.onblocked = () => reject(new Error('Local draft file storage is blocked by another app window.'))
  })
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local draft file storage failed.'))
  })
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(storeName, mode)
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Local draft file storage failed.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Local draft file storage was cancelled.'))
    })
    const result = await action(transaction.objectStore(storeName))
    await completed
    return result
  } finally {
    database.close()
  }
}
