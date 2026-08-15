import { describe, expect, it, vi } from 'vitest'
import { DISPATCH } from '../../lib/outboxDispatch'
import { createSensitiveMutationQueue, isSensitiveMutationAllowed } from '../../lib/sensitiveModeBoundary'

describe('sensitive-mode mutation boundary', () => {
  it('keeps every outbox mutation entry point behind the execution-time guard', () => {
    const guardSensitive = vi.fn(() => false)
    const enqueue = vi.fn()
    const queueMutation = createSensitiveMutationQueue(guardSensitive, enqueue)

    for (const key of Object.keys(DISPATCH)) {
      const [entity, type] = key.split(':')
      const accepted = queueMutation(entity as never, type as never, 'sensitive-' + key)
      expect(accepted, 'must be refused while sensitive mode is active: ' + key).toBe(false)
    }

    expect(guardSensitive).toHaveBeenCalledTimes(Object.keys(DISPATCH).length)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('fails closed while the server-backed preference is pending and opens only when resolved', () => {
    expect(isSensitiveMutationAllowed(true, 'pending')).toBe(false)
    expect(isSensitiveMutationAllowed(false, 'pending')).toBe(false)
    expect(isSensitiveMutationAllowed(true, 'resolved')).toBe(false)
    expect(isSensitiveMutationAllowed(false, 'resolved')).toBe(true)
    expect(isSensitiveMutationAllowed(true, 'unavailable')).toBe(false)
    expect(isSensitiveMutationAllowed(false, 'unavailable')).toBe(true)
  })

  it('allows an execution-time queue after the guard resolves', () => {
    const guardSensitive = vi.fn(() => true)
    const enqueue = vi.fn()
    const queueMutation = createSensitiveMutationQueue(guardSensitive, enqueue)

    expect(queueMutation('transaction' as never, 'update' as never, 'tx-1', { amount: -10 })).toBe(true)
    expect(enqueue).toHaveBeenCalledWith('transaction', 'update', 'tx-1', { amount: -10 }, undefined)
  })
})
