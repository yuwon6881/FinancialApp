import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drainQueue, type DrainQueueDeps } from '@/lib/outboxSync'
import { enqueue, type QueuedOp } from '@/lib/outbox'
import { DISPATCH } from '@/lib/outboxDispatch'
import { state } from '@/test/msw/backend'
import { deobfuscateAmount, obfuscateAmount } from '@/lib/api/amounts'
import { CACHE_KEYS, getCachedOps, setCachedJSON } from '@/lib/cache'
import { createLedgerAccountActions } from '@/app/financialData/accountActions'
import { createLoanActions } from '@/app/financialData/loanActions'
import type { Loan, RecurringPayment } from '@/types'

function makeDrainDeps(queue: QueuedOp[], overrides: Partial<DrainQueueDeps> = {}): DrainQueueDeps {
  return {
    token: 'test-token-prewake',
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

describe('pre-wake outbox queueing and synchronization', () => {
  beforeEach(() => {
    localStorage.clear()
    state.transactions.clear()
  })

  it('enqueues transaction before server wake and durably persists it to localStorage', () => {
    let queue: QueuedOp[] = []
    const txPayload = {
      id: 'tx-prewake-durability-1',
      date: '2026-11-09',
      description: 'Morning Coffee',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -4.5,
    }

    queue = enqueue(queue, 'transaction', 'add', txPayload.id, txPayload)
    setCachedJSON(CACHE_KEYS.pendingOperations, queue)

    const raw = localStorage.getItem(CACHE_KEYS.pendingOperations)
    expect(raw).not.toBeNull()

    const cachedOps = getCachedOps()
    expect(cachedOps).toHaveLength(1)
    expect(cachedOps[0].targetId).toBe('tx-prewake-durability-1')
    expect(cachedOps[0].entity).toBe('transaction')
    expect(cachedOps[0].type).toBe('add')
  })

  it('retains queued operations across simulated app reboot before wake', () => {
    const prewakeOp: QueuedOp = {
      id: 'op-boot-1',
      entity: 'transaction',
      type: 'add',
      targetId: 'tx-prewake-reboot',
      payload: {
        id: 'tx-prewake-reboot',
        date: '2026-11-09',
        description: 'Pre-wake Purchase',
        amount: -12.0,
      },
      createdAt: Date.now(),
      retryCount: 0,
      isCompleted: false,
    }

    setCachedJSON(CACHE_KEYS.pendingOperations, [prewakeOp])

    // Simulate new boot reading storage without network activity:
    const restoredOps = getCachedOps()
    expect(restoredOps).toHaveLength(1)
    expect(restoredOps[0].targetId).toBe('tx-prewake-reboot')
    expect(restoredOps[0].retryCount).toBe(0)
  })

  it('drains queued pre-wake transaction automatically upon server wake-up', async () => {
    localStorage.setItem('auth_token', 'test-token-prewake')

    let queue: QueuedOp[] = []
    queue = enqueue(queue, 'transaction', 'add', 'tx-prewake-wake-1', {
      date: '2026-11-09',
      description: 'Prewake Groceries',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -45.2,
    })

    expect(queue).toHaveLength(1)
    expect(state.transactions.has('tx-prewake-wake-1')).toBe(false)

    // Server wakes up and drain is triggered:
    await drainQueue(makeDrainDeps(queue))

    expect(queue).toHaveLength(0)
    const saved = state.transactions.get('tx-prewake-wake-1')
    expect(saved).toBeDefined()
    expect(saved!.description).toBe('Prewake Groceries')
    expect(deobfuscateAmount(saved!.amount)).toBe(-45.2)
  })

  it('handles duplicate replay idempotently when replaying pre-wake transactions', async () => {
    localStorage.setItem('auth_token', 'test-token-prewake')

    // Simulate backend already having the transaction (from an unacknowledged pre-wake attempt)
    state.transactions.set('tx-prewake-dup-1', {
      id: 'tx-prewake-dup-1',
      date: '2026-11-09',
      description: 'Duplicate Cafe',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: obfuscateAmount(-7.5),
    } as any)

    let queue: QueuedOp[] = []
    queue = enqueue(queue, 'transaction', 'add', 'tx-prewake-dup-1', {
      date: '2026-11-09',
      description: 'Duplicate Cafe',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: -7.5,
    })

    await drainQueue(makeDrainDeps(queue))

    // Drain completes without throwing; queue clears idempotently
    expect(queue).toHaveLength(0)
    expect(state.transactions.has('tx-prewake-dup-1')).toBe(true)
  })
})

describe('strict gating of unsafe actions pre-wake', () => {
  it('blocks account reconciliation when server is not awake and shows toast', () => {
    let queue: QueuedOp[] = []
    const showToast = vi.fn()
    const isServerAwakeRef = { current: false }

    const actions = createLedgerAccountActions({
      accounts: [],
      guardSensitive: () => true,
      enqueue,
      mutateQueue: update => { queue = update(queue) },
      snapshotForUndo: vi.fn(),
      setConfirmModalData: vi.fn(),
      showToast,
      isServerAwakeRef,
    })

    actions.handleReconcileAccounts({
      bucket: 'Essentials',
      expectedBucketTotal: 100,
      operationId: 'rec-1',
      targets: [],
    })

    expect(queue).toHaveLength(0)
    expect(showToast).toHaveBeenCalledWith(
      'Account reconciliation requires a live connection to verify current balances.',
      'Live connection required',
      'warning',
    )

    // When server wakes up, reconciliation is permitted:
    isServerAwakeRef.current = true
    actions.handleReconcileAccounts({
      bucket: 'Essentials',
      expectedBucketTotal: 100,
      operationId: 'rec-2',
      targets: [],
    })
    expect(queue).toHaveLength(1)
    expect(queue[0].entity).toBe('ledgerAccountReconcile')
  })

  it('blocks loan advance repayment and full settlement when server is not awake and shows toast', async () => {
    let queue: QueuedOp[] = []
    const showToast = vi.fn()
    const isServerAwakeRef = { current: false }

    const sampleLoan: Loan = {
      id: 'loan-1',
      name: 'Car Loan',
      recurringPaymentId: 'rp-1',
      openingPrincipal: 10000,
      trackingStartDate: '2026-01-01',
      annualRatePercent: 4.5,
      termPeriods: 36,
      interestMethod: 'ReducingBalance',
      rateBasis: 'Yearly',
      scheduleFrequency: 'Monthly',
      scheduleDueDay: 1,
      scheduleStartDate: '2026-01-01',
      scheduleStatus: 'Complete',
      snapshot: {
        outstandingBalance: 8500,
        scheduledPayment: 300,
        totalScheduledInterest: 500,
        totalInterestPaid: 150,
        payoffDate: '2029-01-01',
        lastOccurrenceDate: '2026-10-01',
        nextPayment: null,
        payments: [],
        futureSchedule: [],
      },
    }

    const actions = createLoanActions({
      loans: [sampleLoan],
      recurringPayments: [] as RecurringPayment[],
      guardSensitive: () => true,
      enqueue,
      mutateQueue: update => { queue = update(queue) },
      snapshotForUndo: vi.fn(),
      setConfirmModalData: vi.fn(),
      showToast,
      isServerAwakeRef,
    })

    await actions.handleAdvanceRepayment('loan-1', 2)
    expect(queue).toHaveLength(0)
    expect(showToast).toHaveBeenCalledWith(
      'Loan repayment actions require a live connection to verify current amortization.',
      'Live connection required',
      'warning',
    )

    await actions.handleFullSettlement('loan-1', 8500)
    expect(queue).toHaveLength(0)
    expect(showToast).toHaveBeenCalledTimes(2)

    // When server wakes up, repayments are permitted:
    isServerAwakeRef.current = true
    await actions.handleAdvanceRepayment('loan-1', 2)
    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('advanceRepayment')

    await actions.handleFullSettlement('loan-1', 8500)
    expect(queue).toHaveLength(2)
    expect(queue[1].type).toBe('fullSettlement')
  })
})
