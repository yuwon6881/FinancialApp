import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOutbox } from './useOutbox'

describe('useOutbox', () => {
  beforeEach(() => localStorage.clear())

  it('persists a durable mutation before reporting success and fails without changing the queue', () => {
    const { result } = renderHook(() => useOutbox({
      token: null, lastUnlockedTimeRef: { current: 0 }, setError: vi.fn(), showToast: vi.fn(),
      onAuthError: vi.fn(), onLockError: vi.fn(), refresh: vi.fn(async () => undefined),
    }))
    act(() => result.current.mutateQueueDurably(previous => result.current.enqueue(previous, 'transaction', 'add', 'capture', { description: 'Cafe' })))
    expect(localStorage.getItem('pending_operations')).toContain('capture')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full') })
    expect(() => result.current.mutateQueueDurably(() => [])).toThrow()
    expect(result.current.getPendingOps()).toHaveLength(1)
    spy.mockRestore()
  })

  it('applies consecutive mutations to the synchronous live queue', () => {
    const lastUnlockedTimeRef = { current: 0 }
    const { result } = renderHook(() => useOutbox({
      token: null,
      lastUnlockedTimeRef,
      setError: vi.fn(),
      showToast: vi.fn(),
      onAuthError: vi.fn(),
      onLockError: vi.fn(),
      refresh: vi.fn(async () => undefined),
    }))

    act(() => {
      result.current.mutateQueue(previous => result.current.enqueue(previous, 'transaction', 'add', 'one', { description: 'One' }))
      result.current.mutateQueue(previous => result.current.enqueue(previous, 'transaction', 'add', 'two', { description: 'Two' }))
    })

    expect(result.current.pendingOps.map(operation => operation.targetId)).toEqual(['one', 'two'])
    expect(result.current.getPendingOps()).toHaveLength(2)
  })

  it('resets queue and failed-state ownership together', () => {
    const { result } = renderHook(() => useOutbox({
      token: null,
      lastUnlockedTimeRef: { current: 0 },
      setError: vi.fn(),
      showToast: vi.fn(),
      onAuthError: vi.fn(),
      onLockError: vi.fn(),
      refresh: vi.fn(async () => undefined),
    }))

    act(() => {
      result.current.mutateQueue(previous => result.current.enqueue(previous, 'category', 'delete', 'one'))
      result.current.setEditingPendingId('one')
      result.current.setDeletingId('one')
      result.current.reset()
    })

    expect(result.current.pendingOps).toEqual([])
    expect(result.current.editingPendingId).toBeNull()
    expect(result.current.deletingId).toBeNull()
  })

  it('surfaces an outbox storage failure without throwing from the effect', async () => {
    const showToast = vi.fn()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    renderHook(() => useOutbox({
      token: null,
      lastUnlockedTimeRef: { current: 0 },
      setError: vi.fn(),
      showToast,
      onAuthError: vi.fn(),
      onLockError: vi.fn(),
      refresh: vi.fn(async () => undefined),
    }))

    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('could not be saved'),
      'Storage Full',
      'error',
    ))
    setItem.mockRestore()
  })
})
