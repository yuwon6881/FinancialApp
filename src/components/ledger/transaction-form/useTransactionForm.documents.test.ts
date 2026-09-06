import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTransactionForm, type UseTransactionFormOptions } from './useTransactionForm'
import type { Transaction, VaultDocument } from '../../../types'

const documentMocks = vi.hoisted(() => ({
  listAllDocumentsForTransaction: vi.fn(),
}))

vi.mock('../../../lib/api/documents', () => ({
  listAllDocumentsForTransaction: documentMocks.listAllDocumentsForTransaction,
  getTaxReliefCategories: vi.fn().mockResolvedValue([]),
  downloadDocument: vi.fn(),
}))

vi.mock('../../../lib/api', () => ({
  startReceiptScan: vi.fn(),
  suggestTransactionCategories: vi.fn(),
  suggestTransactionNotes: vi.fn(),
}))

const CATEGORIES = [{ id: 'food', name: 'Food' }]

const createOptions = (overrides: Partial<UseTransactionFormOptions> = {}): UseTransactionFormOptions => ({
  categories: CATEGORIES,
  currency: 'MYR',
  hideSensitive: false,
  autocompleteSuggestions: [],
  transactions: [],
  essentialsAlloc: 0.5,
  growthAlloc: 0.25,
  stabilityAlloc: 0.15,
  rewardsAlloc: 0.1,
  cycleDay: 28,
  stabilityBalance: 0,
  stabilityTarget: 10_000,
  stabilityOverflowRedirect: 'Rewards',
  onAddTransaction: vi.fn(),
  onUpdateTransaction: vi.fn(),
  ...overrides,
})

const transaction = (id: string): Transaction => ({
  id,
  date: '2026-08-20',
  description: id,
  category: 'Food',
  ledgerCategory: 'Essentials',
  amount: -10,
})

const vaultDocument = (id: number, transactionId: string): VaultDocument => ({
  id,
  originalFileName: `${transactionId}.pdf`,
  contentType: 'application/pdf',
  sizeBytes: 10,
  taxYear: 2026,
  reliefCategory: 'medical',
  amountCurrency: 'MYR',
  amountStatus: 'Confirmed',
  transactionId,
  uploadedAt: '2026-08-20T00:00:00Z',
  retentionUntil: '2033-08-20T00:00:00Z',
})

describe('transaction form attached documents', () => {
  it('ignores a document lookup that resolves after the sheet moved to another transaction', async () => {
    let releaseFirst: ((documents: VaultDocument[]) => void) | undefined
    documentMocks.listAllDocumentsForTransaction
      .mockImplementationOnce(() => new Promise<VaultDocument[]>(resolve => {
        releaseFirst = resolve
      }))
      .mockResolvedValueOnce([vaultDocument(2, 'tx-b')])

    const { result } = renderHook(() => useTransactionForm(createOptions()))

    await act(async () => { result.current.handleStartEdit(transaction('tx-a')) })
    await act(async () => { result.current.handleStartEdit(transaction('tx-b')) })

    expect(result.current.existingDocuments.map(d => d.id)).toEqual([2])

    // tx-a's lookup lands last. Detach unlinks by document id, so letting it write here would
    // offer a file belonging to another transaction for detaching.
    await act(async () => {
      releaseFirst?.([vaultDocument(1, 'tx-a')])
    })

    expect(result.current.existingDocuments.map(d => d.id)).toEqual([2])
  })

  it('drops a document lookup that resolves after the sheet was closed', async () => {
    let release: ((documents: VaultDocument[]) => void) | undefined
    documentMocks.listAllDocumentsForTransaction.mockImplementationOnce(
      () => new Promise<VaultDocument[]>(resolve => {
        release = resolve
      }))

    const { result } = renderHook(() => useTransactionForm(createOptions()))

    await act(async () => { result.current.handleStartEdit(transaction('tx-a')) })
    await act(async () => { result.current.handleCloseForm() })

    await act(async () => {
      release?.([vaultDocument(1, 'tx-a')])
    })

    expect(result.current.existingDocuments).toEqual([])
  })
})
