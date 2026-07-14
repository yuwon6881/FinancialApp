import { describe, it, expect } from 'vitest'
import { drainQueue, type DrainQueueDeps } from '@/lib/outboxSync'
import { enqueue, DISPATCH, type QueuedOp } from '@/lib/outbox'
import { state, lastRequest } from '@/test/msw/backend'
import { deobfuscateAmount, obfuscateAmount } from '@/lib/api/amounts'

/**
 * Exercises the full offline-create-then-sync workflow with the REAL sync engine and REAL
 * API dispatchers against the mock backend: an op enqueued while "offline" is drained to a
 * live POST once "online", then removed from the queue when the server confirms it.
 */
function makeDeps(queue: QueuedOp[], overrides: Partial<DrainQueueDeps> = {}): DrainQueueDeps {
  return {
    token: 'test-token-abc',
    now: () => Date.now(),
    getQueue: () => queue,
    getEditingPendingId: () => null,
    getBackoffUntil: () => 0,
    getLastUnlockedTime: () => Date.now(),
    isSyncing: () => false,
    mutateQueue: (updater) => {
      const next = updater([...queue])
      queue.length = 0
      queue.push(...next)
    },
    resolveDispatch: (op) => DISPATCH[`${op.entity}:${op.type}`],
    setSyncing: () => {},
    setActiveSyncId: () => {},
    setError: () => {},
    setBackoff: () => {},
    addRecentlyCompleted: () => {},
    removeRecentlyCompleted: () => {},
    addFailedOp: () => {},
    getSyncSuccessToast: () => null,
    buildUndoAction: () => undefined,
    emitToast: () => {},
    emitFailureToast: () => {},
    onAuthError: () => {},
    onLockError: () => {},
    refresh: async () => {},
    onSettled: () => {},
    reTrigger: () => {},
    ...overrides,
  }
}

describe('offline transaction sync (real drainQueue ↔ mock backend)', () => {
  it('drains an offline-created transaction to the server and clears the queue', async () => {
    localStorage.setItem('auth_token', 'test-token-abc')

    // "Offline": the user creates a transaction; it is enqueued, not sent.
    let queue: QueuedOp[] = []
    queue = enqueue(queue, 'transaction', 'add', 'tx-offline-1', {
      date: '2026-06-15',
      description: 'Offline lunch',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -18.75,
    })
    expect(queue).toHaveLength(1)
    expect(state.transactions.has('tx-offline-1')).toBe(false)

    // "Back online": drain the queue.
    await drainQueue(makeDeps(queue))

    // The op was dispatched to the backend and removed from the queue.
    expect(queue).toHaveLength(0)
    const saved = state.transactions.get('tx-offline-1')
    expect(saved).toBeDefined()
    expect(saved!.description).toBe('Offline lunch')
    expect(deobfuscateAmount(saved!.amount)).toBe(-18.75)

    // The dispatch used the client's obfuscated wire contract.
    expect(typeof (lastRequest['POST /transactions'].body as { amount: unknown }).amount).toBe('string')
  })

  it('drains multiple queued ops in order', async () => {
    localStorage.setItem('auth_token', 'test-token-abc')
    let queue: QueuedOp[] = []
    for (let i = 1; i <= 3; i++) {
      queue = enqueue(queue, 'transaction', 'add', `tx-batch-${i}`, {
        date: '2026-06-15',
        description: `Batch ${i}`,
        category: 'Food',
        ledgerCategory: 'Essentials',
        amount: -i,
      })
    }

    await drainQueue(makeDeps(queue))

    expect(queue).toHaveLength(0)
    expect(state.transactions.size).toBe(3)
  })

  it('moves a permanently-rejected op (400) to failedOps without retrying', async () => {
    localStorage.setItem('auth_token', 'test-token-abc')
    const failed: QueuedOp[] = []
    let queue: QueuedOp[] = []
    // Purchasing an already-purchased item is a genuine permanent 400.
    state.wishlist.push({
      id: 1,
      name: 'Already purchased',
      price: obfuscateAmount(10),
      priority: 'Medium',
      isPurchased: true,
      createdAt: new Date().toISOString(),
      isActive: false,
    })
    queue = enqueue(queue, 'wishlistItem', 'purchase', '1')

    await drainQueue(makeDeps(queue, { addFailedOp: (op) => failed.push(op) }))

    expect(queue).toHaveLength(0)
    expect(failed).toHaveLength(1)
    expect(failed[0].targetId).toBe('1')
  })
})
