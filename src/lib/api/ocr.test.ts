import { afterEach, describe, expect, it, vi } from 'vitest'
import { obfuscateAmount } from './amounts'
import {
  deleteReceiptScanJob,
  fetchReceiptScanJob,
  startReceiptScan,
} from './ocr'

const jsonResponse = (payload: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => payload,
})

describe('OCR API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts, polls, decodes, and cancels a receipt scan job', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ scanId: 'ocr-1', status: 'queued' }))
      .mockResolvedValueOnce(jsonResponse({
        scanId: 'ocr-1',
        status: 'completed',
        result: {
          description: 'Cafe',
          amount: obfuscateAmount(12.34),
          date: '2026-08-15',
          category: 'Food',
          ledgerCategory: 'Essentials',
          txType: 'outflow',
          confidence: 0.9,
        },
        createdAt: '2026-08-15T00:00:00Z',
        updatedAt: '2026-08-15T00:00:01Z',
        completedAt: '2026-08-15T00:00:01Z',
      }))
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
      })
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })
    await expect(startReceiptScan(file)).resolves.toEqual({ scanId: 'ocr-1', status: 'queued' })
    await expect(fetchReceiptScanJob('ocr-1')).resolves.toMatchObject({
      scanId: 'ocr-1',
      status: 'completed',
      result: expect.objectContaining({ amount: 12.34 }),
    })
    await expect(deleteReceiptScanJob('ocr-1')).resolves.toBeUndefined()

    expect(String(fetchMock.mock.calls[0][0])).toContain('/ocr/scan-receipt/jobs')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect((fetchMock.mock.calls[0][1].body as FormData).get('image')).toBe(file)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/ocr/scan-receipt/jobs/ocr-1')
    expect(fetchMock.mock.calls[1][1]?.method ?? 'GET').toBe('GET')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
  })
})
