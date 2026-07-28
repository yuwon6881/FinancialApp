import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useInvestmentScanPolling } from './useInvestmentScanPolling'
import type { AppTab } from '../types'

const apiMocks = vi.hoisted(() => ({
  fetchInvestmentScanJob: vi.fn(),
  deleteReceiptScanJob: vi.fn(),
}))

vi.mock('./api', () => ({
  fetchInvestmentScanJob: apiMocks.fetchInvestmentScanJob,
  deleteReceiptScanJob: apiMocks.deleteReceiptScanJob,
}))

const options = (isOpen: boolean) => ({
  token: 'token',
  activeTabRef: { current: 'dashboard' as AppTab },
  isInvestmentAddOpenRef: { current: isOpen },
  isMountedRef: { current: true },
  setActiveTab: vi.fn(),
  setAutoOpenInvestmentAdd: vi.fn(),
  showToast: vi.fn(),
})

const completedJob = {
  scanId: 'investment-1',
  status: 'completed' as const,
  result: {
    type: 'Buy' as const,
    accountId: 'account-1',
    instrumentId: 'instrument-1',
    tradeDate: '2026-07-20',
    units: 2,
    unitPrice: 25,
    cashAmount: 50,
    fees: null,
    taxes: null,
    confidence: 0.95,
  },
  createdAt: '2026-07-20T00:00:00Z',
  updatedAt: '2026-07-20T00:00:01Z',
}

describe('useInvestmentScanPolling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    apiMocks.fetchInvestmentScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockReset()
    apiMocks.deleteReceiptScanJob.mockResolvedValue(undefined)
  })

  it('keeps a completed result until the modal consumes and clears it once', async () => {
    localStorage.setItem('investment_scan_job_ids', JSON.stringify(['investment-1']))
    apiMocks.fetchInvestmentScanJob.mockResolvedValue(completedJob)
    const scanOptions = options(true)
    scanOptions.activeTabRef.current = 'investments'
    const { result, unmount } = renderHook(() => useInvestmentScanPolling(scanOptions))

    await waitFor(() => expect(result.current.activeInvestmentScanDraft?.jobId).toBe('investment-1'))
    await act(async () => {
      await Promise.all([
        result.current.clearInvestmentScanJob('investment-1'),
        result.current.clearInvestmentScanJob('investment-1'),
      ])
    })

    expect(apiMocks.deleteReceiptScanJob).toHaveBeenCalledTimes(1)
    expect(result.current.activeInvestmentScanDraft).toBeNull()
    expect(result.current.investmentScanJobIds).toEqual([])
    unmount()
  })

  it('toasts, navigates, and requests the add modal after a background scan completes', async () => {
    localStorage.setItem('investment_scan_job_ids', JSON.stringify(['investment-1']))
    apiMocks.fetchInvestmentScanJob.mockResolvedValue(completedJob)
    const scanOptions = options(false)
    const { result, unmount } = renderHook(() => useInvestmentScanPolling(scanOptions))

    await waitFor(() => expect(result.current.activeInvestmentScanDraft?.jobId).toBe('investment-1'))
    expect(scanOptions.showToast).toHaveBeenCalledWith(
      'Your investment record has been scanned successfully.',
      'Investment Scan Complete',
      'success',
    )

    await waitFor(() => {
      expect(scanOptions.setActiveTab).toHaveBeenCalledWith('investments')
      expect(scanOptions.setAutoOpenInvestmentAdd).toHaveBeenCalledWith(true)
    }, { timeout: 2000 })
    unmount()
  })
})
