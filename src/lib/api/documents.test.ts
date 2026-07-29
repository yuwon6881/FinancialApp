import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteDocument,
  downloadDocument,
  listDocumentTypes,
  listDocuments,
  updateDocument,
  uploadDocument,
  uploadDocuments,
} from './documents'

const okJson = (payload: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => payload,
})

describe('documents API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uploads multiple files in one multipart request and returns per-file results', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      results: [
        { fileName: 'one.pdf', uploaded: true, id: 1 },
        { fileName: 'too-large.pdf', uploaded: false, message: 'The document exceeds the maximum allowed size.' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)
    const files = [
      new File(['one'], 'one.pdf', { type: 'application/pdf' }),
      new File(['two'], 'too-large.pdf', { type: 'application/pdf' }),
    ]

    const results = await uploadDocuments(files, 2025, 'Receipt', undefined, 'lifestyle')

    expect(results).toHaveLength(2)
    expect(results[1].uploaded).toBe(false)
    const form = fetchMock.mock.calls[0][1].body as FormData
    expect(form.getAll('files')).toHaveLength(2)
    expect(form.get('reliefCategory')).toBe('lifestyle')
  })

  it('uploads multipart data without setting a content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['%PDF-1.4 test'], 'test.pdf', { type: 'application/pdf' })

    await uploadDocument(file, 2026, 'Receipt', 'Annual filing')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/documents')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
    const formData = init.body as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('taxYear')).toBe('2026')
    expect(formData.get('documentType')).toBe('Receipt')
  })

  it('lists with filters and sends authenticated mutation requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson({ items: [], totalCount: 0 }))
      .mockResolvedValueOnce(okJson({
        id: 4,
        originalFileName: 'tax.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10,
        taxYear: 2025,
        documentType: 'Tax Return',
        uploadedAt: '2026-01-01T00:00:00Z',
        retentionUntil: '2032-12-31',
      }))
      .mockResolvedValueOnce({ ...okJson(undefined), status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await listDocuments(2026, 'tx-1', 'tax', 50, 25)
    await updateDocument(4, { transactionId: null })
    await deleteDocument(4)

    const listUrl = String(fetchMock.mock.calls[0][0])
    expect(listUrl).toContain('taxYear=2026')
    expect(listUrl).toContain('transactionId=tx-1')
    expect(listUrl).toContain('search=tax')
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    expect(fetchMock.mock.calls[1][1].body).toBe('{"transactionId":null}')
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE')
  })

  it('downloads through apiFetch and honors the response filename', async () => {
    const createObjectUrl = vi.fn(() => 'blob:test')
    const revokeObjectUrl = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === 'content-disposition'
        ? "attachment; filename*=UTF-8''filed%20return.pdf"
        : null },
      blob: async () => new Blob(['vault bytes'], { type: 'application/pdf' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await downloadDocument(9, 'fallback.pdf')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/documents/9/content')
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test')
  })

  it('treats an empty successful document type response as an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    }))

    await expect(listDocumentTypes()).resolves.toEqual([])
  })
})
