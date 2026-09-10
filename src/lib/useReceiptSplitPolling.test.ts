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
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['ocr-split-complete']))
    apiMocks.fetchReceiptSplitScanJob.mockResolvedValue({
      scanId: 'ocr-split-complete',
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
      expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-complete')
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
      await result.current.clearReceiptSplitJob('ocr-split-complete')
    })

    expect(result.current.receiptSplitJobIds).toEqual([])
    expect(result.current.activeReceiptSplitDraft).toBeNull()
    expect(apiMocks.deleteReceiptScanJob).toHaveBeenCalledWith('ocr-split-complete')
    expect(JSON.parse(localStorage.getItem('receipt_split_scan_job_ids') || '[]')).toEqual([])
    unmount()
  })

  it('announces each completed scan once when two are waiting', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['ocr-split-a', 'ocr-split-b']))
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
    expect(result.current.receiptSplitJobIds).toEqual(['ocr-split-a', 'ocr-split-b'])
    expect(options.showToast).toHaveBeenCalledTimes(2)
    unmount()
  })

  const completed = (scanId: string) => ({
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
  })

  const pollingOptions = () => ({
    token: 'token',
    isReceiptSplitOpenRef: { current: false },
    setActiveTab: vi.fn(),
    setAutoOpenReceiptSplit: vi.fn(),
    showToast: vi.fn(),
  })

  // Two finished scans used to take turns as the active draft on every poll pass, which re-seeded
  // an open editor from a different receipt every three seconds and discarded the quantities,
  // unlocked prices and edited description already chosen there.
  it('holds a second finished scan instead of swapping the draft under the editor', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['ocr-split-a', 'ocr-split-b']))
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    await waitFor(() => {
      expect(options.showToast).toHaveBeenCalledTimes(2)
    })
    expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-a')

    // Both results are already in hand, so no later pass can promote the other one.
    const passes = apiMocks.fetchReceiptSplitScanJob.mock.calls.length
    await waitFor(() => {
      expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-a')
    })
    expect(apiMocks.fetchReceiptSplitScanJob.mock.calls.length).toBe(passes)
    unmount()
  })

  it('reveals the next finished scan once the active one is cleared', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['ocr-split-a', 'ocr-split-b']))
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    await waitFor(() => {
      expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-a')
    })
    await act(async () => {
      await result.current.clearReceiptSplitJob('ocr-split-a')
    })

    expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-b')
    expect(result.current.receiptSplitJobIds).toEqual(['ocr-split-b'])
    unmount()
  })

  // The form that started the scan opens the editor itself and renders a failure inline, so an
  // announcement for one of its jobs would say the same thing twice.
  it('leaves the announcement to the form that is still waiting on the scan', async () => {
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    act(() => result.current.handleReceiptSplitStarted('ocr-split-form'))
    await waitFor(() => {
      expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-form')
    })

    expect(options.showToast).not.toHaveBeenCalled()
    unmount()
  })

  it('announces a scan whose form went away before it landed', async () => {
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    act(() => {
      result.current.handleReceiptSplitStarted('ocr-split-orphan')
      result.current.releaseReceiptSplitReview('ocr-split-orphan')
    })

    await waitFor(() => {
      expect(options.showToast).toHaveBeenCalledTimes(1)
    })
    unmount()
  })

  // A second finished receipt's toast must open its own receipt, not whichever draft happens to
  // be active.
  it('reviews the scan its own toast names', async () => {
    localStorage.setItem('receipt_split_scan_job_ids', JSON.stringify(['ocr-split-a', 'ocr-split-b']))
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    await waitFor(() => {
      expect(options.showToast).toHaveBeenCalledTimes(2)
    })
    act(() => options.showToast.mock.calls[1]?.[3]?.onAction())

    expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-b')
    expect(options.setActiveTab).toHaveBeenCalledWith('ledger')
    expect(options.setAutoOpenReceiptSplit).toHaveBeenCalledWith(true)
    unmount()
  })

  // An upload the pending-upload queue finished after a relaunch has no form standing by, so the
  // toast is the only thing that can lead the user back to it.
  it('announces a scan the upload queue started in the background', async () => {
    apiMocks.fetchReceiptSplitScanJob.mockImplementation(async (scanId: string) => completed(scanId))
    const options = pollingOptions()
    const { result, unmount } = renderHook(() => useReceiptSplitPolling(options))

    act(() => result.current.handleReceiptSplitStarted('ocr-split-drained', false))

    await waitFor(() => {
      expect(options.showToast).toHaveBeenCalledTimes(1)
    })
    expect(result.current.activeReceiptSplitDraft?.jobId).toBe('ocr-split-drained')
    unmount()
  })
})
