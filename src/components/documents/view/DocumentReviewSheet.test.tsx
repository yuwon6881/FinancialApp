import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultDocument } from '../../../types'
import { DocumentReviewSheet } from './DocumentReviewSheet'

vi.mock('../../../contexts/AppContext', () => ({
  useAppPrefs: () => ({ hideSensitive: false, currency: 'MYR' }),
  useAppUi: () => ({ showToast: vi.fn() }),
}))
// The preview is its own component with its own tests; here it only has to occupy its place.
vi.mock('./DocumentPreviewPane', () => ({ DocumentPreviewPane: () => <div data-testid="preview" /> }))

const listDocuments = vi.fn()
vi.mock('../../../lib/api/documents', () => ({
  listDocuments: (...args: unknown[]) => listDocuments(...args),
  getTaxReliefCategories: async () => [
    { id: 'dental', name: 'Dental examination', limit: 1000 },
    { id: 'medical', name: 'Medical', limit: 1000 },
  ],
}))

const doc = (id: number, patch: Partial<VaultDocument> = {}): VaultDocument => ({
  id,
  originalFileName: `receipt-${id}.pdf`,
  contentType: 'application/pdf',
  sizeBytes: 1000,
  taxYear: 2026,
  reliefCategory: 'dental',
  amount: 99,
  amountCurrency: 'MYR',
  amountStatus: 'NeedsReview',
  amountConfidence: 0.9,
  uploadedAt: '2026-10-25T00:00:00Z',
  retentionUntil: '2033-12-31T00:00:00Z',
  ...patch,
})

describe('DocumentReviewSheet', () => {
  beforeEach(() => {
    listDocuments.mockReset()
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 0 }
  })

  it('walks the unconfirmed amounts one by one, confirming each with Enter', async () => {
    listDocuments.mockResolvedValue({ items: [doc(1), doc(2, { amountStatus: 'Confirmed' }), doc(3, { amount: 40 })], totalCount: 3 })
    const saveReview = vi.fn().mockResolvedValue(undefined)
    render(<DocumentReviewSheet request={{ taxYear: 2026 }} onClose={vi.fn()} currency="MYR" saveReview={saveReview} />)

    const first = await screen.findByLabelText('Amount for receipt-1.pdf') as HTMLInputElement
    expect(first.value).toBe('99.00')
    expect(screen.getByText('1 of 2')).toBeTruthy()
    fireEvent.keyDown(first, { key: 'Enter' })
    await waitFor(() => expect(saveReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { amount: 99, amountCurrency: 'MYR', amountStatus: 'Confirmed' },
    ))

    // The confirmed document is skipped; the next unconfirmed one is already filled in.
    const second = await screen.findByLabelText('Amount for receipt-3.pdf') as HTMLInputElement
    fireEvent.change(second, { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('All caught up')).toBeTruthy()
    expect(saveReview).toHaveBeenLastCalledWith(expect.objectContaining({ id: 3 }), expect.objectContaining({ amount: 45 }))
  })

  it('reviews exactly the documents just uploaded, and lets one be skipped', async () => {
    listDocuments.mockResolvedValue({ items: [doc(5, { amount: null, amountStatus: 'NotFound' }), doc(6)], totalCount: 2 })
    const saveReview = vi.fn().mockResolvedValue(undefined)
    render(<DocumentReviewSheet request={{ taxYear: 2026, documentIds: [5] }} onClose={vi.fn()} currency="MYR" saveReview={saveReview} />)

    const input = await screen.findByLabelText('Amount for receipt-5.pdf') as HTMLInputElement
    expect(input.value).toBe('')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText(/Enter the amount on the receipt/)).toBeTruthy()
    expect(saveReview).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(await screen.findByText(/0 of 1 confirmed/)).toBeTruthy()
  })
})
