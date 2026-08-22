import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useReceiptScanDraft } from './useReceiptScanDraft'

const apiMocks = vi.hoisted(() => ({
  startReceiptScan: vi.fn(),
}))

vi.mock('../../../lib/api', () => ({
  startReceiptScan: apiMocks.startReceiptScan,
}))

function createOptions(overrides: Partial<Parameters<typeof useReceiptScanDraft>[0]> = {}) {
  return {
    autoOpenAddForm: false,
    receiptScanDraft: null,
    activeScanJobIds: [],
    failedScanJob: null,
    onReceiptScanStarted: vi.fn(),
    onReceiptScanCleared: vi.fn(),
    applyReceiptScanResult: vi.fn(),
    openTransactionForm: vi.fn(),
    onStartEditPending: vi.fn(),
    ...overrides,
  }
}

describe('useReceiptScanDraft', () => {
  beforeEach(() => {
    apiMocks.startReceiptScan.mockReset()
  })

  it('keeps the completed job id consumable and clears it at most once', async () => {
    const onReceiptScanCleared = vi.fn()
    const receiptScanDraft = {
      jobId: 'scan-complete',
      result: {
        description: 'Groceries',
        amount: 24.9,
        date: '2026-07-16',
        category: 'Food',
        ledgerCategory: 'Essentials',
        txType: 'outflow' as const,
        confidence: 0.95,
      },
    }
    const options = createOptions({
      autoOpenAddForm: true,
      receiptScanDraft,
      activeScanJobIds: ['scan-complete'],
      onReceiptScanCleared,
    })

    const { result } = renderHook(() => useReceiptScanDraft(options))

    await waitFor(() => {
      expect(result.current.activeReceiptScanJobId).toBe('scan-complete')
    })
    expect(options.applyReceiptScanResult).toHaveBeenCalledWith(receiptScanDraft.result)

    act(() => {
      result.current.clearScan()
      result.current.clearScan()
    })

    expect(onReceiptScanCleared).toHaveBeenCalledTimes(1)
    expect(onReceiptScanCleared).toHaveBeenCalledWith('scan-complete')
    expect(result.current.activeReceiptScanJobId).toBeNull()
  })

  it('surfaces a failed locally-started scan even when tracking is removed in the same update', async () => {
    apiMocks.startReceiptScan.mockResolvedValue({ scanId: 'scan-failed', status: 'queued' })
    const onReceiptScanCleared = vi.fn()

    const initialOptions = createOptions({
      activeScanJobIds: ['scan-failed'],
      onReceiptScanCleared,
    })
    const { result, rerender } = renderHook(
      (options) => useReceiptScanDraft(options),
      { initialProps: initialOptions },
    )

    await act(async () => {
      await result.current.handleScanReceipt(new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }))
    })
    expect(result.current.activeReceiptScanJobId).toBe('scan-failed')
    expect(result.current.isScanning).toBe(true)

    rerender({
      ...initialOptions,
      activeScanJobIds: [],
      failedScanJob: {
        jobId: 'scan-failed',
        errorMessage: 'The image was too blurry.',
      },
    })

    await waitFor(() => {
      expect(result.current.scanError).toBe('The image was too blurry.')
    })
    expect(result.current.isScanning).toBe(false)
    expect(result.current.activeReceiptScanJobId).toBeNull()
    expect(onReceiptScanCleared).not.toHaveBeenCalled()
  })
})
