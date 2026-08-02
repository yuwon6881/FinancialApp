import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useOptimisticList, useSyncStatus } from './useOptimisticList'
import type { QueuedOp } from './outbox'

interface TestItem {
  id: string
  name: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

function makeOp(overrides: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op-1',
    entity: 'transaction',
    type: 'update',
    targetId: '1',
    createdAt: 0,
    retryCount: 0,
    ...overrides,
  }
}

describe('useOptimisticList', () => {
  it('applies queued ops from the active-ops queue on top of the base list', () => {
    const base: TestItem[] = [{ id: '1', name: 'Old' }]
    const ops = [makeOp({ type: 'update', targetId: '1', payload: { name: 'New' } })]
    const { result } = renderHook(() => useOptimisticList(base, ops, 'transaction'))
    expect(result.current[0]).toMatchObject({ name: 'New', isPendingSync: true })
  })

  it('returns the base list unchanged when there are no ops for this entity', () => {
    const base: TestItem[] = [{ id: '1', name: 'A' }]
    const { result } = renderHook(() => useOptimisticList(base, [], 'transaction'))
    expect(result.current).toEqual(base)
  })

  it('recomputes when a new op is queued (rerender with a changed ops array)', () => {
    const base: TestItem[] = [{ id: '1', name: 'A' }]
    const { result, rerender } = renderHook(
      ({ ops }) => useOptimisticList(base, ops, 'transaction'),
      { initialProps: { ops: [] as QueuedOp[] } }
    )
    expect(result.current[0].name).toBe('A')

    rerender({ ops: [makeOp({ type: 'update', targetId: '1', payload: { name: 'B' } })] })
    expect(result.current[0].name).toBe('B')
  })
})

describe('useSyncStatus', () => {
  const list: TestItem[] = [{ id: '1', name: 'A', isPendingDelete: true }, { id: '2', name: 'B' }]

  it('reports syncing only for the currently active sync id', () => {
    const { result } = renderHook(() => useSyncStatus(list, '2', null))
    expect(result.current.isSyncing('2')).toBe(true)
    expect(result.current.isSyncing('1')).toBe(false)
  })

  it('reports syncing for every row participating in a direct multi-record mutation', () => {
    const { result } = renderHook(() => useSyncStatus(list, ['1', '2'], null))
    expect(result.current.isSyncing('1')).toBe(true)
    expect(result.current.isSyncing('2')).toBe(true)
    expect(result.current.isSyncing('3')).toBe(false)
  })

  it('reports deleting for either the explicit deletingId or an isPendingDelete item', () => {
    const { result } = renderHook(() => useSyncStatus(list, null, '2'))
    expect(result.current.isDeleting('2')).toBe(true) // explicit deletingId match
    expect(result.current.isDeleting('1')).toBe(true) // isPendingDelete flag on the item itself
    expect(result.current.isDeleting('3')).toBe(false)
  })
})
