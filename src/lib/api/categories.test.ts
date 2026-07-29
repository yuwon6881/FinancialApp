import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories } from './categories'
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
})
