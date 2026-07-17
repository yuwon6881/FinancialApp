import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReceiptScanPolling } from './useReceiptScanPolling'

const apiMocks = vi.hoisted(() => ({
  fetchReceiptScanJob: vi.fn(),
  deleteReceiptScanJob: vi.fn(),
}))

vi.mock('./api', () => ({
  fetchReceiptScanJob: apiMocks.fetchReceiptScanJob,
  deleteReceiptScanJob: apiMocks.deleteReceiptScanJob,
}))

function createOptions(isLedgerAddOpen: boolean) {
  return {
    token: 'token',
    activeTabRef: { current: 'ledger' as const },
    isLedgerAddOpenRef: { current: isLedgerAddOpen },
    isMountedRef: { current: true },
    setActiveTab: vi.fn(),
    setAutoOpenLedgerAdd: vi.fn(),
    showToast: vi.fn(),
  }
}

describe('useReceiptScanPolling', () => {
  beforeEach(() => {
    apiMocks.fetchReceiptScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockResolvedValue(undefined)
  })

  it('retains a completed job until consumption, then clears it once and does not restore it', async () => {
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify(['scan-complete']))
    apiMocks.fetchReceiptScanJob.mockResolvedValue({
      scanId: 'scan-complete',
      status: 'completed',
      result: {
        description: 'Lunch',
        amount: 12.5,
        date: '2026-07-16',
        category: 'Food',
        ledgerCategory: 'Essentials',
        txType: 'outflow',
        confidence: 0.95,
      },
      createdAt: '2026-07-16T00:00:00Z',
      updatedAt: '2026-07-16T00:00:01Z',
    })

    const options = createOptions(true)
    const first = renderHook(() => useReceiptScanPolling(options))

    await waitFor(() => {
      expect(first.result.current.activeReceiptScanDraft?.jobId).toBe('scan-complete')
    })
    expect(first.result.current.receiptScanJobIds).toEqual(['scan-complete'])

    await act(async () => {
      await Promise.all([
        first.result.current.clearReceiptScanJob('scan-complete'),
        first.result.current.clearReceiptScanJob('scan-complete'),
      ])
    })

    expect(apiMocks.deleteReceiptScanJob).toHaveBeenCalledTimes(1)
    expect(first.result.current.activeReceiptScanDraft).toBeNull()
    expect(first.result.current.receiptScanJobIds).toEqual([])
    expect(JSON.parse(localStorage.getItem('receipt_scan_job_ids') || '[]')).toEqual([])

    first.unmount()
    apiMocks.fetchReceiptScanJob.mockClear()

    const restarted = renderHook(() => useReceiptScanPolling(options))
    expect(restarted.result.current.receiptScanJobIds).toEqual([])
    expect(apiMocks.fetchReceiptScanJob).not.toHaveBeenCalled()
    restarted.unmount()
  })

  it('keeps an in-modal failure available after removing and deleting the failed job', async () => {
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify(['scan-failed']))
    apiMocks.fetchReceiptScanJob.mockResolvedValue({
      scanId: 'scan-failed',
      status: 'failed',
      result: null,
      errorMessage: 'The image was too blurry.',
      createdAt: '2026-07-16T00:00:00Z',
      updatedAt: '2026-07-16T00:00:01Z',
    })

    const options = createOptions(true)
    const { result, unmount } = renderHook(() => useReceiptScanPolling(options))

    await waitFor(() => {
      expect(result.current.failedScanJob).toEqual({
        jobId: 'scan-failed',
        errorMessage: 'The image was too blurry.',
      })
    })

    expect(result.current.receiptScanJobIds).toEqual([])
    expect(apiMocks.deleteReceiptScanJob).toHaveBeenCalledTimes(1)
    expect(options.showToast).not.toHaveBeenCalled()
    unmount()
  })

  it('does not restore a completed draft from a poll that resolves after the job was cleared', async () => {
    let resolveJob!: (job: {
      scanId: string
      status: string
      result: {
        description: string
        amount: number
        date: string
        category: string
        ledgerCategory: string
        txType: string
      }
      createdAt: string
      updatedAt: string
    }) => void
    apiMocks.fetchReceiptScanJob.mockReturnValue(new Promise(resolve => {
      resolveJob = resolve
    }))
    localStorage.setItem('receipt_scan_job_ids', JSON.stringify(['scan-cleared']))

    const options = createOptions(true)
    const { result, unmount } = renderHook(() => useReceiptScanPolling(options))

    await waitFor(() => {
      expect(apiMocks.fetchReceiptScanJob).toHaveBeenCalledWith('scan-cleared')
    })

    await act(async () => {
      await result.current.clearReceiptScanJob('scan-cleared')
      resolveJob({
        scanId: 'scan-cleared',
        status: 'completed',
        result: {
          description: 'Late receipt',
          amount: 10,
          date: '2026-07-16',
          category: 'Food',
          ledgerCategory: 'Essentials',
          txType: 'outflow',
        },
        createdAt: '2026-07-16T00:00:00Z',
        updatedAt: '2026-07-16T00:00:01Z',
      })
      await Promise.resolve()
    })

    expect(result.current.activeReceiptScanDraft).toBeNull()
    expect(result.current.receiptScanJobIds).toEqual([])
    unmount()
  })
})
