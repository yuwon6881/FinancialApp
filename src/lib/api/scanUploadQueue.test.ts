import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drainPendingScanUploads, startScanUpload } from './scanUploadQueue'
import type { PendingScanUpload } from '../scanUploadStore'

const compressionMocks = vi.hoisted(() => ({ compressImageFile: vi.fn() }))
vi.mock('../imageCompression', () => ({ compressImageFile: compressionMocks.compressImageFile }))

const storeMocks = vi.hoisted(() => ({
  savePendingScanUpload: vi.fn(),
  deletePendingScanUpload: vi.fn(),
  listPendingScanUploads: vi.fn(),
}))
vi.mock('../scanUploadStore', () => storeMocks)

const accepted = (scanId: string) => ({
  ok: true,
  status: 202,
  headers: { get: () => null },
  json: async () => ({ scanId, status: 'queued' }),
})

const refused = (status: number, message: string) => ({
  ok: false,
  status,
  headers: { get: () => null },
  json: async () => ({ message }),
})

const stored = (overrides: Partial<PendingScanUpload>): PendingScanUpload => ({
  uploadId: 'upload-1',
  kind: 'receipt',
  blob: new Blob(['image']),
  fileName: 'receipt.jpg',
  fileType: 'image/jpeg',
  createdAt: 1,
  ...overrides,
})

describe('scan upload queue', () => {
  beforeEach(() => {
    compressionMocks.compressImageFile.mockImplementation(async (file: File) => file)
    storeMocks.savePendingScanUpload.mockResolvedValue(true)
    storeMocks.deletePendingScanUpload.mockResolvedValue(undefined)
    storeMocks.listPendingScanUploads.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Object.values(storeMocks).forEach(mock => mock.mockReset())
    compressionMocks.compressImageFile.mockReset()
  })

  it('writes the picked image down before sending it and clears it once accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(accepted('ocr-1'))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })

    await expect(startScanUpload('receipt', file)).resolves.toEqual({ scanId: 'ocr-1', status: 'queued' })

    expect(storeMocks.savePendingScanUpload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'receipt', blob: file, fileName: 'receipt.jpg' }),
    )
    // The write happens first: an upload interrupted before the response is the case this exists for.
    expect(storeMocks.savePendingScanUpload.mock.invocationCallOrder[0])
      .toBeLessThan(fetchMock.mock.invocationCallOrder[0])
    expect(storeMocks.deletePendingScanUpload).toHaveBeenCalledTimes(1)
    // The in-memory file is what goes up, never a copy read back out of storage.
    expect((fetchMock.mock.calls[0][1].body as FormData).get('image')).toBe(file)
  })

  it('keeps the image and says it is queued when the connection drops mid-upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })

    await expect(startScanUpload('receipt-split', file)).rejects.toThrow(/will scan itself once you are back online/)

    expect(storeMocks.deletePendingScanUpload).not.toHaveBeenCalled()
  })

  it('surfaces the raw failure when the image could not be written down', async () => {
    storeMocks.savePendingScanUpload.mockResolvedValue(false)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })

    await expect(startScanUpload('receipt', file)).rejects.toThrow('Failed to fetch')
  })

  // A refusal about the image itself is the user's to act on now; re-sending it on every wake-up
  // would just burn their data.
  it('drops an image the server will never accept', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(refused(413, 'Receipt image is too large.')))
    const file = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })

    await expect(startScanUpload('receipt', file)).rejects.toThrow('Receipt image is too large.')

    expect(storeMocks.deletePendingScanUpload).toHaveBeenCalledWith(expect.any(String))
  })

  it('finishes what the queue still owes, oldest first', async () => {
    storeMocks.listPendingScanUploads.mockResolvedValue([
      stored({ uploadId: 'upload-old', kind: 'receipt', createdAt: 1 }),
      stored({ uploadId: 'upload-new', kind: 'investment', createdAt: 2, fileName: 'broker.webp' }),
    ])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(accepted('ocr-old'))
      .mockResolvedValueOnce(accepted('ocr-new'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(drainPendingScanUploads()).resolves.toEqual({
      started: [
        { kind: 'receipt', scanId: 'ocr-old' },
        { kind: 'investment', scanId: 'ocr-new' },
      ],
      discarded: [],
      remaining: 0,
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('/ocr/scan-receipt/jobs')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/ocr/scan-investment/jobs')
    expect(storeMocks.deletePendingScanUpload).toHaveBeenCalledTimes(2)
  })

  it('stops at the first upload that still cannot land', async () => {
    storeMocks.listPendingScanUploads.mockResolvedValue([
      stored({ uploadId: 'upload-1', createdAt: 1 }),
      stored({ uploadId: 'upload-2', createdAt: 2 }),
      stored({ uploadId: 'upload-3', createdAt: 3 }),
    ])
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(accepted('ocr-1'))
      .mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await drainPendingScanUploads()

    expect(result.started).toEqual([{ kind: 'receipt', scanId: 'ocr-1' }])
    expect(result.remaining).toBe(2)
    // One dead connection means the third would fail the same way.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // The two it could not send are still owed, untouched.
    expect(storeMocks.deletePendingScanUpload).toHaveBeenCalledTimes(1)
  })

  it('reports an upload the server refused so the user knows the photo is gone', async () => {
    storeMocks.listPendingScanUploads.mockResolvedValue([stored({ uploadId: 'upload-1' })])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(refused(415, 'Unsupported receipt image.')))

    const result = await drainPendingScanUploads()

    expect(result).toEqual({ started: [], discarded: ['receipt'], remaining: 0 })
    expect(storeMocks.deletePendingScanUpload).toHaveBeenCalledWith('upload-1')
  })

  // A locked session is answered the moment the user unlocks; the image is still wanted.
  it('holds an upload refused by a locked session', async () => {
    storeMocks.listPendingScanUploads.mockResolvedValue([stored({ uploadId: 'upload-1' })])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(refused(423, 'Locked')))

    const result = await drainPendingScanUploads()

    expect(result).toEqual({ started: [], discarded: [], remaining: 1 })
    expect(storeMocks.deletePendingScanUpload).not.toHaveBeenCalled()
  })
})
