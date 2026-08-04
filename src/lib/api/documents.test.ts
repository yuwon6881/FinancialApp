import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invalidateAllDocumentCaches } from './documentsCache'
import {
  bulkUpdateDocumentCategories,
  addTaxReliefCategory,
  deleteDocument,
  downloadDocument,
  downloadSelectedDocumentArchive,
  getDocumentContent,
  getTaxReliefCategories,
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
    invalidateAllDocumentCaches()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
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

    const results = await uploadDocuments(files, 2025, 'lifestyle')

    expect(results).toHaveLength(2)
    expect(results[1].uploaded).toBe(false)
    const form = fetchMock.mock.calls[0][1].body as FormData
    expect(form.getAll('files')).toHaveLength(2)
    expect(form.get('reliefCategory')).toBe('lifestyle')
  })

  it('saves multiple document category changes in one request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({
      results: [
        { id: 1, updated: true },
        { id: 2, updated: false, message: 'The category is not configured for this document\'s tax year.' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const results = await bulkUpdateDocumentCategories([
      { id: 1, reliefCategory: 'education' },
      { id: 2, reliefCategory: 'lifestyle' },
    ])

    expect(results[0].updated).toBe(true)
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({
      updates: [
        { id: 1, reliefCategory: 'education' },
        { id: 2, reliefCategory: 'lifestyle' },
      ],
    }))
  })

  it('chunks category changes at the server limit', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { updates: { id: number; reliefCategory: string }[] }
      return okJson({ results: body.updates.map(update => ({ id: update.id, updated: true })) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const updates = Array.from({ length: 101 }, (_, id) => ({ id: id + 1, reliefCategory: 'education' }))
    const results = await bulkUpdateDocumentCategories(updates)

    expect(results).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).updates).toHaveLength(100)
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).updates).toHaveLength(1)
  })

  it('invalidates cached relief categories after a category mutation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okJson([{ id: 'lifestyle', name: 'Lifestyle', limit: 100 }]))
      .mockResolvedValueOnce(okJson({ id: 'education', name: 'Education', limit: 200 }))
      .mockResolvedValueOnce(okJson([
        { id: 'lifestyle', name: 'Lifestyle', limit: 100 },
        { id: 'education', name: 'Education', limit: 200 },
      ]))
    vi.stubGlobal('fetch', fetchMock)

    await getTaxReliefCategories(2026)
    await addTaxReliefCategory(2026, { name: 'Education', limit: 200 })
    const categories = await getTaxReliefCategories(2026)

    expect(categories).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uploads multipart data without setting a content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ id: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['%PDF-1.4 test'], 'test.pdf', { type: 'application/pdf' })

    await uploadDocument(file, 2026, undefined, undefined, 'lifestyle', 123.45, 'OTHER')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/documents')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
    const formData = init.body as FormData
    expect(formData.get('file')).toBe(file)
    expect(formData.get('taxYear')).toBe('2026')
    expect(formData.get('reliefCategory')).toBe('lifestyle')
    expect(formData.get('amount')).toBe('123.45')
    expect(formData.get('amountCurrency')).toBe('OTHER')
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
        uploadedAt: '2026-01-01T00:00:00Z',
        retentionUntil: '2032-12-31',
      }))
      .mockResolvedValueOnce({ ...okJson(undefined), status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await listDocuments(2026, 'tx-1', 50, 25, ['education'], 'name-asc')
    await updateDocument(4, { transactionId: null })
    await deleteDocument(4)

    const listUrl = String(fetchMock.mock.calls[0][0])
    expect(listUrl).toContain('taxYear=2026')
    expect(listUrl).toContain('transactionId=tx-1')
    expect(listUrl).not.toContain('search=')
    expect(listUrl).toContain('reliefCategory=education')
    expect(listUrl).toContain('sort=name-asc')
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

  it('returns authenticated document content for an inline preview', async () => {
    const blob = new Blob(['vault bytes'], { type: 'application/pdf' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => {
        if (name.toLowerCase() === 'content-disposition') return "attachment; filename*=UTF-8''filed%20return.pdf"
        if (name.toLowerCase() === 'content-type') return 'application/pdf'
        return null
      } },
      blob: async () => blob,
    })
    vi.stubGlobal('fetch', fetchMock)

    const content = await getDocumentContent(9, 'fallback.pdf')

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/documents/9/content')
    expect(content).toEqual({ blob, fileName: 'filed return.pdf', contentType: 'application/pdf' })
  })

  it('downloads a ZIP archive for the selected documents', async () => {
    const createObjectUrl = vi.fn(() => 'blob:selected')
    const revokeObjectUrl = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    sessionStorage.setItem('csrf_token', 'test-token')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: async () => new Blob(['zip bytes'], { type: 'application/zip' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await downloadSelectedDocumentArchive([3, 7])

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/documents/export-selected')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ ids: [3, 7] }))
    expect(createObjectUrl).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:selected')
    sessionStorage.removeItem('csrf_token')
  })

  describe('caching behavior', () => {
    beforeEach(() => {
      invalidateAllDocumentCaches()
      vi.useFakeTimers()
    })

    it('deduplicates identical document list requests', async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ items: [], totalCount: 0 }))
      vi.stubGlobal('fetch', fetchMock)

      const first = listDocuments(2026, undefined, 0, 50)
      const second = listDocuments(2026, undefined, 0, 50)

      await Promise.all([first, second])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('different tax years, offsets, and page sizes do not collide', async () => {
      const fetchMock = vi.fn().mockResolvedValue(okJson({ items: [], totalCount: 0 }))
      vi.stubGlobal('fetch', fetchMock)

      await listDocuments(2025, undefined, 0, 50)
      await listDocuments(2026, undefined, 0, 50)
      await listDocuments(2025, undefined, 50, 50)
      await listDocuments(2025, undefined, 0, 25)

      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    it('upload/update/delete invalidates the correct keys', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(okJson({ items: [], totalCount: 0 }))
        .mockResolvedValueOnce(okJson({ id: 1 }))
        .mockResolvedValueOnce(okJson({ items: [], totalCount: 0 }))
        .mockResolvedValueOnce(okJson({ id: 1 }))
        .mockResolvedValueOnce(okJson({ items: [], totalCount: 0 }))
        .mockResolvedValueOnce({ ...okJson(undefined), status: 204 })
        .mockResolvedValueOnce(okJson({ items: [], totalCount: 0 }))

      vi.stubGlobal('fetch', fetchMock)

      await listDocuments(2026)
      await listDocuments(2026)

      await uploadDocument(new File([''], 'test.pdf'), 2026, undefined, undefined, 'lifestyle')
      await listDocuments(2026)
      await listDocuments(2026)

      await updateDocument(1, { transactionId: 'test' })
      await listDocuments(2026)

      await deleteDocument(1)
      await listDocuments(2026)

      expect(fetchMock).toHaveBeenCalledTimes(7)
    })
  })
})

