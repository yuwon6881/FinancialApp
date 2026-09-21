import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDraftTransactionDocuments,
  loadDraftTransactionDocumentChanges,
  saveDraftTransactionDocumentChanges,
} from './draftTransactionDocuments'

type StoredRecord = { key: string; [key: string]: unknown }

function createIndexedDbDouble(): IDBFactory {
  const records = new Map<string, StoredRecord>()
  const stores = new Set<string>()

  const request = <T>(result: T): IDBRequest<T> => {
    const pending = {} as IDBRequest<T>
    queueMicrotask(() => pending.onsuccess?.(new Event('success') as Event))
    Object.defineProperty(pending, 'result', { value: result, configurable: true })
    return pending
  }

  const open = {} as IDBOpenDBRequest
  const database = {
    objectStoreNames: { contains: (name: string) => stores.has(name) },
    createObjectStore: (name: string) => {
      stores.add(name)
      return {
        indexNames: { contains: () => false },
        createIndex: () => undefined,
      } as unknown as IDBObjectStore
    },
    transaction: () => {
      const transaction = {
        oncomplete: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onabort: null as ((event: Event) => void) | null,
        objectStore: () => {
          return ({
          put: (value: StoredRecord) => {
            records.set(value.key, value)
            const result = request(value)
            queueMicrotask(() => transaction.oncomplete?.(new Event('complete') as Event))
            return result
          },
          get: (key: string) => {
            const result = request(records.get(key))
            queueMicrotask(() => transaction.oncomplete?.(new Event('complete') as Event))
            return result
          },
          delete: (key: string) => {
            records.delete(key)
            const result = request(undefined)
            queueMicrotask(() => transaction.oncomplete?.(new Event('complete') as Event))
            return result
          },
          clear: () => {
            records.clear()
            const result = request(undefined)
            queueMicrotask(() => transaction.oncomplete?.(new Event('complete') as Event))
            return result
          },
          }) as unknown as IDBObjectStore
        },
      }
      return transaction as unknown as IDBTransaction
    },
    close: () => undefined,
  } as unknown as IDBDatabase

  return {
    open: () => {
      queueMicrotask(() => {
        Object.defineProperty(open, 'result', { value: database, configurable: true })
        if (stores.size === 0) open.onupgradeneeded?.(new Event('upgradeneeded') as IDBVersionChangeEvent)
        open.onsuccess?.(new Event('success') as Event)
      })
      return open
    },
  } as unknown as IDBFactory
}

describe('draft transaction document storage', () => {
  const originalIndexedDb = globalThis.indexedDB

  beforeEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: createIndexedDbDouble(),
    })
  })

  afterEach(async () => {
    await clearDraftTransactionDocuments()
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: originalIndexedDb,
    })
  })

  it('does not hydrate a draft document from another account', async () => {
    const changes = {
      pending: [{
        file: new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }),
        taxYear: 2026,
        reliefCategory: 'Medical',
      }],
      unlinkIds: [7],
    }

    await saveDraftTransactionDocumentChanges('account-a', 'draft-1', changes)

    expect(await loadDraftTransactionDocumentChanges('account-b', 'draft-1')).toEqual({
      pending: [],
      unlinkIds: [],
    })
    const restored = await loadDraftTransactionDocumentChanges('account-a', 'draft-1')
    expect(restored.unlinkIds).toEqual([7])
    expect(restored.pending[0].file.name).toBe('receipt.pdf')
  })
})
