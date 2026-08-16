import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultDocument } from '../types'
import { EMPTY_RETENTION_REVIEW } from '../lib/documentRetention'

/**
 * First coverage for the Vault page shell itself. Everything asserted here was previously untested,
 * which is how the retention banner, the staged-category bar and both bulk handlers came to carry
 * the bugs this file now pins.
 */

const api = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  getDocumentOverview: vi.fn(),
  getTaxReliefCategories: vi.fn(),
  bulkUpdateDocumentCategories: vi.fn(),
  bulkDeleteDocuments: vi.fn(),
  deleteDocument: vi.fn(),
  updateDocument: vi.fn(),
  downloadDocument: vi.fn(),
  downloadDocumentArchive: vi.fn(),
  downloadSelectedDocumentArchive: vi.fn(),
  getDocumentConstraints: vi.fn(),
  addTaxReliefCategory: vi.fn(),
  updateTaxReliefCategory: vi.fn(),
  deleteTaxReliefCategory: vi.fn(),
  getDocumentPreviewUrl: vi.fn(() => 'blob:preview'),
  getDocumentContent: vi.fn(),
  getDocumentContentUrl: vi.fn(() => '/documents/1/content'),
}))

vi.mock('../lib/api/documents', () => ({ ...api, DOCUMENT_BULK_LIMIT: 100 }))

import { DocumentsView } from './DocumentsView'

const document: VaultDocument = {
  id: 1,
  originalFileName: 'tax.pdf',
  contentType: 'application/pdf',
  sizeBytes: 12,
  taxYear: 2026,
  transactionId: null,
  uploadedAt: '2026-07-29T00:00:00Z',
  retentionUntil: '2033-12-31',
  reliefCategory: 'lifestyle',
  amount: null,
  amountCurrency: 'MYR',
  amountStatus: 'Unavailable',
  amountConfidence: null,
  amountExtractionMessage: null,
}

const documentOverview = {
  usage: { totalBytes: 12, documentCount: 1, quotaBytes: 1000 },
  availableYears: [2026],
  retention: EMPTY_RETENTION_REVIEW,
  selectedTaxYear: 2026,
  summary: {
    taxYear: 2026,
    confirmedAmount: 0,
    pendingReviewAmount: 0,
    documentCount: 1,
    categories: [],
  },
  reliefCategories: [
    { id: 'lifestyle', name: 'Lifestyle', limit: 2500 },
    { id: 'medical', name: 'Medical', limit: 8000 },
  ],
}

describe('DocumentsView', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  beforeEach(() => {
    vi.clearAllMocks()
    api.listDocuments.mockResolvedValue({ items: [document], totalCount: 1 })
    api.getTaxReliefCategories.mockResolvedValue([
      { id: 'lifestyle', name: 'Lifestyle', limit: 2500 },
      { id: 'medical', name: 'Medical', limit: 8000 },
    ])
    api.getDocumentOverview.mockResolvedValue(documentOverview)
    api.deleteDocument.mockResolvedValue(undefined)
  })

  it('says nothing about retention when no year is near its keep-until date', async () => {
    render(<DocumentsView />)

    await waitFor(() => expect(screen.getAllByText('tax.pdf').length).toBeGreaterThan(0))
    // Exception-only: a notice whose whole message is "all is well" trains the eye to skip the
    // region a real alert lands in.
    expect(screen.queryByText(/older than you need to keep/)).toBeNull()
    expect(screen.queryByText(/Nothing is ever deleted for you/)).toBeNull()
  })

  it('shows an honest retry state instead of a false empty Vault after a load failure', async () => {
    api.listDocuments.mockRejectedValue(new Error('Vault service is unavailable.'))
    render(<DocumentsView />)

    expect((await screen.findByRole('alert')).textContent).toContain('Documents unavailable')
    expect(screen.getByText('Vault service is unavailable.')).toBeTruthy()
    expect(screen.queryByText(/No documents/i)).toBeNull()

    api.listDocuments.mockResolvedValue({ items: [document], totalCount: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getAllByText('tax.pdf').length).toBeGreaterThan(0))
    expect(screen.queryByText('Documents unavailable')).toBeNull()
  })

  it('warns before the keep-until date and keeps the manual-only promise', async () => {
    api.getDocumentOverview.mockResolvedValue({ ...documentOverview, retention: {
      taxYears: [
        { taxYear: 2019, documentCount: 3, totalBytes: 1_400_000, keepUntil: '2026-12-31', daysUntilKeepUntil: 150 },
      ],
      noticeWindowDays: 180,
      keepYears: 7,
    } })

    render(<DocumentsView />)

    expect(await screen.findByText('Some tax records can be cleared out soon')).toBeTruthy()
    expect(screen.getByText(/in about 5 months/)).toBeTruthy()
    expect(screen.getByText(/Nothing is ever deleted for you/)).toBeTruthy()
  })

  it('forgets staged category edits when the filters change', async () => {
    render(<DocumentsView />)
    await waitFor(() => expect(screen.getAllByText('tax.pdf').length).toBeGreaterThan(0))

    // CustomSelect is a combobox/listbox, not a native <select>, so it is opened and its option
    // clicked. `fireEvent.change` on it is silently a no-op.
    fireEvent.click(screen.getAllByLabelText('Tax relief category for tax.pdf')[0])
    fireEvent.click(screen.getAllByRole('option', { name: 'Medical' })[0])
    await waitFor(() => expect(screen.getByText(/Save them together/i)).toBeTruthy())

    // Changing the sort re-queries the server, so the staged rows are no longer the rows on screen.
    // Left behind, the bar counted documents the user could not see and Save wrote them anyway.
    fireEvent.click(screen.getByLabelText('Sort vault documents'))
    fireEvent.click(screen.getByRole('option', { name: /Sort: Name A/ }))

    await waitFor(() => expect(screen.queryByText(/Save them together/i)).toBeNull())
  })

  it('refreshes the tax insights after a single delete, so the tracker cannot go stale', async () => {
    render(<DocumentsView />)
    await waitFor(() => expect(screen.getAllByText('tax.pdf').length).toBeGreaterThan(0))

    const overviewCallsBefore = api.getDocumentOverview.mock.calls.length

    fireEvent.click(screen.getAllByLabelText(/^Delete tax\.pdf$/i)[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith(1))
    await waitFor(() =>
      expect(api.getDocumentOverview.mock.calls.length).toBeGreaterThan(overviewCallsBefore))
  })
})
