import { afterEach, describe, expect, it, vi } from 'vitest'
import { invalidateAllDocumentCaches, documentListCacheKey } from './documentsCache'
import { listDocuments } from './documents'

const response = (payload: unknown, etag: string | null = null) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => name.toLowerCase() === 'etag' ? etag : null },
  json: async () => payload,
})

describe('document cache keys and conditional reads', () => {
  afterEach(() => {
    invalidateAllDocumentCaches()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('includes pagination, filter set, and sort in the list key', () => {
    expect(documentListCacheKey(2026, undefined, 0, 10, ['education', 'lifestyle'], 'name-asc'))
      .toBe(documentListCacheKey(2026, undefined, 0, 10, ['lifestyle', 'education'], 'name-asc'))
    expect(documentListCacheKey(2026, undefined, 0, 10)).not.toBe(documentListCacheKey(2026, undefined, 10, 10))
    expect(documentListCacheKey(2026, undefined, 0, 10)).not.toBe(documentListCacheKey(2026, undefined, 0, 10, [], 'name-asc'))
  })

  it('revalidates an expired page with its ETag while keeping pages separate', async () => {
    vi.useFakeTimers()
    const payload = { items: [], totalCount: 0 }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(payload, '"page-0"'))
      .mockResolvedValueOnce(response({ items: [], totalCount: 11 }, '"page-1"'))
      .mockResolvedValueOnce({
        ok: false,
        status: 304,
        headers: { get: (name: string) => name.toLowerCase() === 'etag' ? '"page-0"' : null },
      })
    vi.stubGlobal('fetch', fetchMock)

    await listDocuments(2026, undefined, 0, 10)
    await listDocuments(2026, undefined, 10, 10)
    vi.advanceTimersByTime(15_001)
    const refreshed = await listDocuments(2026, undefined, 0, 10)

    expect(refreshed).toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('skip=10')
  })
})
