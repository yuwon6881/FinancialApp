import { describe, expect, it, vi } from 'vitest'
import { saveCapturedPurchase } from './saveCapturedPurchase'
import type { PurchaseCapture } from './purchaseCapture'

const transaction = { amount: -12, description: 'Cafe', date: '2026-09-27', category: 'Food', ledgerCategory: 'Essentials' }
const candidate = { id: 'capture', transactionId: 'stable', prepared: transaction } as PurchaseCapture

describe('captured purchase approval', () => {
  it('retries an interrupted completion with the same ID and original payload', async () => {
    const enqueue = vi.fn()
    const complete = vi.fn().mockRejectedValueOnce(new Error('Interrupted')).mockResolvedValueOnce(undefined)
    const deps = { prepare: vi.fn().mockResolvedValue(candidate), enqueue, complete }
    await expect(saveCapturedPurchase(candidate, transaction, deps)).rejects.toThrow('Interrupted')
    await saveCapturedPurchase(candidate, { ...transaction, amount: -99 }, deps)
    expect(enqueue.mock.calls).toEqual([['stable', transaction], ['stable', transaction]])
  })
  it('does not complete when durable queue persistence fails', async () => {
    const complete = vi.fn()
    await expect(saveCapturedPurchase(candidate, transaction, {
      prepare: vi.fn().mockResolvedValue(candidate), enqueue: () => { throw new Error('Storage full') }, complete,
    })).rejects.toThrow('Storage full')
    expect(complete).not.toHaveBeenCalled()
  })
  it('does not enqueue completed captures', async () => {
    const enqueue = vi.fn()
    await saveCapturedPurchase(candidate, transaction, {
      prepare: vi.fn().mockResolvedValue({ completed: true }), enqueue, complete: vi.fn(),
    })
    expect(enqueue).not.toHaveBeenCalled()
  })
})
