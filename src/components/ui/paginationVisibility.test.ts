import { describe, expect, it } from 'vitest'
import { shouldShowPagination } from './paginationVisibility'

describe('shouldShowPagination', () => {
  it('returns false when items fit on one page at the smallest page size', () => {
    expect(shouldShowPagination({ totalPages: 1, totalItems: 5, pageSizeOptions: [10, 25, 50] })).toBe(false)
  })

  it('returns true when totalPages > 1', () => {
    expect(shouldShowPagination({ totalPages: 3, totalItems: 30, pageSizeOptions: [10, 25, 50] })).toBe(true)
  })

  it('returns true during server fetch even if items fit on one page', () => {
    expect(shouldShowPagination({ totalPages: 1, totalItems: 5, serverIsFetching: true, pageSizeOptions: [10, 25, 50] })).toBe(true)
  })

  it('returns true when totalItems exceeds the smallest page size', () => {
    expect(shouldShowPagination({ totalPages: 1, totalItems: 20, pageSizeOptions: [10, 25, 50] })).toBe(true)
  })

  it('handles empty pageSizeOptions safely using Infinity', () => {
    expect(shouldShowPagination({ totalPages: 1, totalItems: 20, pageSizeOptions: [] })).toBe(false)
  })
})
