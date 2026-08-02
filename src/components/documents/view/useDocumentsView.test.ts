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
  deleteTaxReliefCategory: vi.fn(),
  bulkDeleteDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  bulkUpdateDocumentCategories: vi.fn(),
}))

vi.mock('../../../lib/api/documents', () => api)

const document = {
  id: 1,
  originalFileName: 'tax.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12,
  taxYear: 2026,
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
    api.addTaxReliefCategory.mockResolvedValue({ id: 'category', name: 'Category', limit: 100 })
    api.updateTaxReliefCategory.mockResolvedValue({ id: 'category', name: 'Category', limit: 100 })
    api.deleteTaxReliefCategory.mockResolvedValue(undefined)
    api.bulkDeleteDocuments.mockResolvedValue([])
    api.deleteDocument.mockResolvedValue(undefined)
    api.bulkUpdateDocumentCategories.mockResolvedValue([{ id: 1, updated: true }])
  })

  it('loads documents and usage, then updates local state after deletion', async () => {
    const { result } = renderHook(() => useDocumentsView())

    await waitFor(() => expect(result.current.documents).toEqual([document]))
    expect(result.current.isInitialLoading).toBe(false)
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

  it('clamps the page and reloads after bulk deletion removes the current page', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc'))

    api.listDocuments.mockResolvedValue({ items: [document], totalCount: 11 })
    act(() => result.current.setPage(2))
    await waitFor(() => {
      expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 10, 10, undefined, 'uploaded-desc')
      expect(result.current.totalCount).toBe(11)
    })

    api.bulkDeleteDocuments.mockResolvedValue([{ id: 1, deleted: true }])
    await act(async () => {
      await result.current.bulkDelete([1])
    })

    await waitFor(() => expect(result.current.page).toBe(1))
    expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc')
  })

  it('reloads page one when the tax-year filter changes', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalled())

    act(() => result.current.setTaxYear(2025))

    await waitFor(() => {
      expect(api.listDocuments).toHaveBeenLastCalledWith(2025, undefined, 0, 10, undefined, 'uploaded-desc')
    })
  })

  it('requests later pages from the server and resets the offset when the page size changes', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc'))

    act(() => result.current.setPage(2))
    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 10, 10, undefined, 'uploaded-desc'))

    act(() => result.current.setPage(1))
    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc'))

    act(() => result.current.setPageSize(25))
    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 25, undefined, 'uploaded-desc'))
    expect(result.current.page).toBe(1)
  })

  it('updates staged category results locally after one bulk request', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(result.current.documents).toEqual([document]))

    await act(async () => {
      await result.current.bulkUpdateDocumentCategories([{ id: 1, reliefCategory: 'education' }])
    })

    expect(api.bulkUpdateDocumentCategories).toHaveBeenCalledWith([{ id: 1, reliefCategory: 'education' }])
    expect(result.current.documents[0].reliefCategory).toBe('education')
  })

  it('reloads the active category filter after a bulk category update', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc'))

    act(() => result.current.setReliefCategory('education'))
    await waitFor(() => expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 10, 'education', 'uploaded-desc'))

    await act(async () => {
      await result.current.bulkUpdateDocumentCategories([{ id: 1, reliefCategory: 'education' }])
    })

    expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 10, 'education', 'uploaded-desc')
  })

  it('applies a tracker category and document sort through the same paged request', async () => {
    const { result } = renderHook(() => useDocumentsView())
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledWith(2026, undefined, 0, 10, undefined, 'uploaded-desc'))

    act(() => {
      result.current.setReliefCategory('education')
      result.current.setSortOrder('name-asc')
    })

    await waitFor(() => {
      expect(api.listDocuments).toHaveBeenLastCalledWith(2026, undefined, 0, 10, 'education', 'name-asc')
    })
  })
})

