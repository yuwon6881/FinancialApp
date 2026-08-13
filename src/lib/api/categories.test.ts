import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories, fetchCategoryUsage } from './categories'
import { invalidateCache } from './client'

describe('categories API', () => {
  afterEach(() => {
    invalidateCache()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('treats an empty successful category response as an empty list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: { get: () => null },
    }))

    await expect(fetchCategories()).resolves.toEqual([])
  })

  it('requests compact usage counts for an inclusive date range', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => [{ categoryKey: 'food', count: 501 }],
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCategoryUsage('2026-07-01', '2026-07-31')).resolves.toEqual([
      { categoryKey: 'food', count: 501 },
    ])
    expect(String(fetchMock.mock.calls[0][0])).toContain('/categories/usage?startDate=2026-07-01&endDate=2026-07-31')
  })
})
