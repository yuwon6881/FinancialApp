import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReceiptSplitPolling } from './useReceiptSplitPolling'

const apiMocks = vi.hoisted(() => ({
  fetchReceiptSplitScanJob: vi.fn(),
  deleteReceiptScanJob: vi.fn(),
}))

vi.mock('./api', () => ({
  fetchReceiptSplitScanJob: apiMocks.fetchReceiptSplitScanJob,
  deleteReceiptScanJob: apiMocks.deleteReceiptScanJob,
}))

describe('useReceiptSplitPolling', () => {
  beforeEach(() => {
    localStorage.clear()
    apiMocks.fetchReceiptSplitScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockResolvedValue(undefined)
  })

  it('restores a persisted scan, opens its review sheet, and clears it after consumption', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['split-complete']))
    apiMocks.fetchReceiptSplitScanJob.mockResolvedValue({
      scanId: 'split-complete',
      status: 'completed',
      result: {
        description: 'Dinner',
        date: '2026-07-28',
        currency: 'MYR',
        subtotal: 20,
        total: 23.2,
        category: 'Food',
        ledgerCategory: 'Essentials',
        items: [],
        charges: [],
        fieldConfidence: { description: 1, date: 1, currency: 1, subtotal: 1, total: 1 },
        truncated: false,
        warnings: [],
        confidence: 1,
      },
      createdAt: '2026-07-28T00:00:00Z',
      updatedAt: '2026-07-28T00:00:01Z',
    })
    const options = {
      token: 'token',
      isReceiptSplitOpenRef: { current: false },
      setActiveTab: vi.fn(),
      setAutoOpenReceiptSplit: vi.fn(),
      showToast: vi.fn(),
    }
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    await waitFor(() => {
      expect(result.current.activeReceiptSplitDraft?.jobId).toBe('split-complete')
    })
    expect(options.showToast).toHaveBeenCalledWith(
      'Receipt items were prepared for review.',
      'Receipt Split Completed',
      'success',
      expect.objectContaining({ label: 'Review' }),
    )
    expect(options.setActiveTab).not.toHaveBeenCalled()
    expect(options.setAutoOpenReceiptSplit).not.toHaveBeenCalled()
    act(() => options.showToast.mock.calls[0]?.[3]?.onAction())
    expect(options.setActiveTab).toHaveBeenCalledWith('ledger')
    expect(options.setAutoOpenReceiptSplit).toHaveBeenCalledWith(true)

    await act(async () => {
      await result.current.clearReceiptSplitJob('split-complete')
    })

    expect(result.current.receiptSplitJobIds).toEqual([])
    expect(result.current.activeReceiptSplitDraft).toBeNull()
    expect(apiMocks.deleteReceiptScanJob).toHaveBeenCalledWith('split-complete')
    expect(JSON.parse(localStorage.getItem('receipt_split_scan_job_ids') || '[]')).toEqual([])
    unmount()
  })

  it('announces each completed scan once when two are waiting', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['split-a', 'split-b']))
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => ({
      scanId,
      status: 'completed',
      result: {
        description: 'Dinner',
        date: '2026-07-28',
        currency: 'MYR',
        subtotal: 20,
        total: 20,
        category: 'Food',
        ledgerCategory: 'Essentials',
        items: [],
        charges: [],
        fieldConfidence: { description: 1, date: 1, currency: 1, subtotal: 1, total: 1 },
        truncated: false,
        warnings: [],
        confidence: 1,
      },
      createdAt: '2026-07-28T00:00:00Z',
      updatedAt: '2026-07-28T00:00:01Z',
    }))
    const options = {
      token: 'token',
      isReceiptSplitOpenRef: { current: false },
      setActiveTab: vi.fn(),
      setAutoOpenReceiptSplit: vi.fn(),
      showToast: vi.fn(),
    }
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    // Both jobs stay tracked and take turns as the active draft, so a missing one-shot
    // record would re-announce them on every poll pass.
    await waitFor(() => {
      expect(options.showToast).toHaveBeenCalledTimes(2)
    })
    // Each announcement changes the notified record and the active draft, which restarts the
    // poll effect with an immediate pass. Both jobs are still tracked and still complete, so a
    // missing one-shot record shows up here as a third toast.
    expect(result.current.receiptSplitJobIds).toEqual(['split-a', 'split-b'])
    expect(options.showToast).toHaveBeenCalledTimes(2)
    unmount()
  })
})
