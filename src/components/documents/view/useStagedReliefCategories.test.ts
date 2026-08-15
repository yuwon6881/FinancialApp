import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VaultDocument } from '../../../types'
import { useStagedReliefCategories } from './useStagedReliefCategories'

const document = (id: number, reliefCategory: string | null = 'lifestyle') => ({
  id,
  reliefCategory,
} as VaultDocument)

function options(documents: VaultDocument[], bulkUpdate = vi.fn().mockResolvedValue([])) {
  return {
    documents,
    bulkUpdate,
    setRowsSyncing: vi.fn(),
    showToast: vi.fn(),
    guardSensitive: vi.fn(() => true),
  }
}

describe('useStagedReliefCategories', () => {
  it('clears staged rows when the active filtered selection changes', () => {
    const initial = options([document(1)])
    const { result, rerender } = renderHook(
      props => useStagedReliefCategories(props),
      { initialProps: initial },
    )

    act(() => result.current.stage(1, 'education'))
    expect(result.current.staged.has(1)).toBe(true)

    rerender(options([document(2)]))
    act(() => result.current.clear())

    expect(result.current.staged.size).toBe(0)
  })

  it('forgets a deleted document so Save cannot send its staged entry again', () => {
    const { result } = renderHook(() => useStagedReliefCategories(options([document(1)])))

    act(() => result.current.stage(1, 'education'))
    act(() => result.current.forget([1]))

    expect(result.current.staged.size).toBe(0)
  })

  it('does not let an in-flight save clear a newer choice for the same row', async () => {
    let resolve!: (value: { id: number; updated: boolean }[]) => void
    const bulkUpdate = vi.fn(() => new Promise<{ id: number; updated: boolean }[]>(res => {
      resolve = res
    }))
    const { result } = renderHook(() => useStagedReliefCategories(options([document(1)], bulkUpdate)))

    act(() => result.current.stage(1, 'education'))
    let save!: Promise<void>
    await act(async () => {
      save = result.current.save()
      await Promise.resolve()
      result.current.stage(1, 'medical')
      resolve([{ id: 1, updated: true }])
      await save
    })

    expect(bulkUpdate).toHaveBeenCalledWith([{ id: 1, reliefCategory: 'education' }])
    expect(result.current.staged.get(1)).toBe('medical')
  })
})
