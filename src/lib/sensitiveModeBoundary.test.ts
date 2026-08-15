import { describe, expect, it, vi } from 'vitest'
import { createSensitiveMutationQueue, isSensitiveMutationAllowed } from './sensitiveModeBoundary'

describe('sensitiveModeBoundary', () => {
  describe('isSensitiveMutationAllowed', () => {
    it('returns false when sensitive preference status is pending', () => {
      expect(isSensitiveMutationAllowed(false, 'pending')).toBe(false)
      expect(isSensitiveMutationAllowed(true, 'pending')).toBe(false)
    })

    it('returns false when sensitive mode is active (hideSensitive is true)', () => {
      expect(isSensitiveMutationAllowed(true, 'resolved')).toBe(false)
    })

    it('returns true when sensitive mode is revealed (hideSensitive is false)', () => {
      expect(isSensitiveMutationAllowed(false, 'resolved')).toBe(true)
    })
  })

  describe('createSensitiveMutationQueue', () => {
    it('blocks enqueue and returns false when guardSensitive returns false', () => {
      const guardSensitive = vi.fn().mockReturnValue(false)
      const enqueue = vi.fn()
      const queue = createSensitiveMutationQueue(guardSensitive, enqueue)

      const allowed = queue('transaction', 'add', 'tx-1', { amount: 100 })
      expect(allowed).toBe(false)
      expect(guardSensitive).toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
    })

    it('calls enqueue and returns true when guardSensitive returns true', () => {
      const guardSensitive = vi.fn().mockReturnValue(true)
      const enqueue = vi.fn()
      const queue = createSensitiveMutationQueue(guardSensitive, enqueue)

      const payload = { amount: 100 }
      const allowed = queue('transaction', 'add', 'tx-1', payload, false)
      expect(allowed).toBe(true)
      expect(guardSensitive).toHaveBeenCalled()
      expect(enqueue).toHaveBeenCalledWith('transaction', 'add', 'tx-1', payload, false)
    })
  })
})
