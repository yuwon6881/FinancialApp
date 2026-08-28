import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useClientPagination } from './useClientPagination'

describe('useClientPagination', () => {
  it('clamps a page when the filtered collection gets shorter', () => {
    const { result, rerender } = renderHook(
      ({ total }) => useClientPagination(total, 9),
      { initialProps: { total: 20 } },
    )

    act(() => result.current.setPage(3))
    rerender({ total: 5 })
    expect(result.current.page).toBe(1)
  })

  it('reveals a highlighted item on its containing page', () => {
    const { result } = renderHook(() => useClientPagination(20, 9, 12))
    expect(result.current.page).toBe(2)
    expect(result.current.start).toBe(9)
    expect(result.current.end).toBe(18)
  })
})
