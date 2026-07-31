import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentsView } from './useDocumentsView'

const api = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  getDocumentUsage: vi.fn(),
  getAvailableDocumentYears: vi.fn(),
  getExpiredTaxYears: vi.fn(),
  getTaxYearReliefSummary: vi.fn(),
  getTaxReliefCategories: vi.fn(),
  addTaxReliefCategory: vi.fn(),
  updateTaxReliefCategory: vi.fn(),
  bulkDeleteDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
}))

vi.mock('../../../lib/api/documents', () => api)

const document = {
  id: 1,
  originalFileName: 'tax.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12,
  taxYear: 2026,
  notes: null,
  transactionId: null,
  uploadedAt: '2026-07-29T00:00:00Z',
  retentionUntil: '2033-12-31',
  reliefCategory: null,
  amount: null,
  amountCurrency: 'MYR',
  amountStatus: 'Unavailable',
  amountConfidence: null,
  amountExtractionMessage: null,
}

describe('useDocumentsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listDocuments.mockResolvedValue({ items: [document], totalCount: 1 })
    api.getDocumentUsage.mockResolvedValue({ totalBytes: 12, documentCount: 1 })
    api.getAvailableDocumentYears.mockResolvedValue([2026, 2025])
    api.getExpiredTaxYears.mockResolvedValue([])
    api.getTaxYearReliefSummary.mockResolvedValue({
      taxYear: 2026,
      confirmedAmount: 0,
      pendingReviewAmount: 0,
      documentCount: 1,
      categories: [],
    })
    api.getTaxReliefCategories.mockResolvedValue([])
    api.addTaxReliefCategory.mockResolvedValue({ id: 'category', name: 'Category', limit: 100, detail: '' })
    api.updateTaxReliefCategory.mockResolvedValue({ id: 'category', name: 'Category', limit: 100, detail: '' })
    api.bulkDeleteDocuments.mockResolvedValue([])
    api.deleteDocument.mockResolvedValue(undefined)
  })

  it('loads documents and usage, then updates local state after deletion', async () => {
    const { result } = renderHook(() => useDocumentsView())

    await waitFor(() => expect(result.current.documents).toEqual([document]))
    expect(result.current.usage).toEqual({ totalBytes: 12, documentCount: 1 })

    api.getDocumentUsage.mockResolvedValue({ totalBytes: 0, documentCount: 0 })
    await act(async () => {
      await result.current.deleteDocument(1)
    })

    expect(api.deleteDocument).toHaveBeenCalledWith(1)
    expect(result.current.documents).toEqual([])
    expect(result.current.totalCount).toBe(0)
    await waitFor(() => expect(result.current.usage).toEqual({ totalBytes: 0, documentCount: 0 }))
  })

  it('reloads page one when the tax-year filter changes', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalled())

    act(() => result.current.setTaxYear(2025))

    await waitFor(() => {
      expect(api.listDocuments).toHaveBeenLastCalledWith(2025, undefined, '', 0, 50)
    })
  })
})
