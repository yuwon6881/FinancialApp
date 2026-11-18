import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueuedOp } from '../../lib/outbox'
import type { TransactionDocumentChanges } from '../../types'
import { createOutboxRefreshHandler, type UseOutboxRefreshOptions } from './useOutboxRefresh'

const stored = new Map<string, TransactionDocumentChanges>()
const deleteStored = vi.fn(async (owner: string, targetId: string) => { stored.delete(`${owner}:${targetId}`) })

vi.mock('../../lib/draftTransactionDocuments', () => ({
  loadDraftTransactionDocumentChanges: async (owner: string, targetId: string) =>
    stored.get(`${owner}:${targetId}`) ?? { pending: [], unlinkIds: [] },
  deleteDraftTransactionDocumentChanges: (owner: string, targetId: string) => deleteStored(owner, targetId),
}))

const uploadDocument = vi.fn().mockResolvedValue({})
vi.mock('../../lib/api/documents', () => ({
  uploadDocument: (...args: unknown[]) => uploadDocument(...args),
  bulkUpdateDocumentTransactionLinks: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../lib/imageCompression', () => ({ compressImageFile: async (file: File) => file }))

const options = (owner?: string): UseOutboxRefreshOptions => ({
  pendingTransactionDocumentsRef: { current: new Map() },
  pendingTransactionDocumentDeletesRef: { current: new Map() },
  showToast: vi.fn(),
  getPendingOps: () => [],
  setError: vi.fn(),
  isServerAwakeRef: { current: true },
  setWishlist: vi.fn(),
  setSavingsGoals: vi.fn(),
  loanData: {} as UseOutboxRefreshOptions['loanData'],
  setRecurringPayments: vi.fn(),
  setAccounts: vi.fn(),
  setCategoriesList: vi.fn(),
  loadAll: vi.fn().mockResolvedValue(undefined),
  selectedMonth: 'Jul',
  selectedYear: 2026,
  unconfirmedSettingWritesRef: { current: new Map() },
  documentOwner: owner,
})

const addOp = { id: 'op-1', entity: 'transaction', type: 'add', targetId: 'tx-1', payload: {} } as unknown as QueuedOp

describe('outbox refresh: attachments waiting on a queued add', () => {
  beforeEach(() => {
    stored.clear()
    deleteStored.mockClear()
    uploadDocument.mockClear()
  })

  it('uploads attachment changes kept durably across a reload, then clears them', async () => {
    const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })
    stored.set('sam:tx-1', {
      pending: [{ file, taxYear: 2026, reliefCategory: 'Lifestyle' }],
      unlinkIds: [],
    })

    // Memory is empty, as it is after a reload: only the durable copy remains.
    await createOutboxRefreshHandler(options('sam'))([{ op: addOp }])

    expect(uploadDocument).toHaveBeenCalledWith(file, 2026, 'tx-1', undefined, 'Lifestyle', undefined, undefined)
    expect(deleteStored).toHaveBeenCalledWith('sam', 'tx-1')
  })
})
