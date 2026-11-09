import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderHook, act } from '@testing-library/react'
import { drainQueue, type DrainQueueDeps } from '@/lib/outboxSync'
import { enqueue, type QueuedOp } from '@/lib/outbox'
import { DISPATCH } from '@/lib/outboxDispatch'
import * as backend from '@/test/msw/backend'
import { server } from '@/test/msw/server'
import { deobfuscateAmount, obfuscateAmount } from '@/lib/api/amounts'
import { CACHE_KEYS, getCachedOps, setCachedJSON } from '@/lib/cache'
import { useOutbox } from '@/lib/useOutbox'
import { createLedgerAccountActions } from '@/app/financialData/accountActions'
import { createLoanActions } from '@/app/financialData/loanActions'
import { useTransactionFormSubmit } from '@/components/ledger/transaction-form/useTransactionFormSubmit'
import type { LedgerAccount, Loan, RecurringPayment } from '@/types'

function makeDrainDeps(queue: QueuedOp[], overrides: Partial<DrainQueueDeps> = {}): {
  deps: DrainQueueDeps
  getQueue: () => QueuedOp[]
  setBackoffCalls: number[]
  backoffAttempts: number[]
} {
  const setBackoffCalls: number[] = []
  let backoffAttempt = 0
  const backoffAttempts: number[] = []

  const deps: DrainQueueDeps = {
    token: 'test-token-adversarial',
    now: () => 1_700_000_000_000,
    getQueue: () => queue,
    getEditingPendingId: () => null,
    getBackoffUntil: () => 0,
    getBackoffAttempt: () => backoffAttempt,
    setBackoffAttempt: (att) => {
      backoffAttempt = att
      backoffAttempts.push(att)
    },
    getLastUnlockedTime: () => 1_700_000_000_000,
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
    setBackoff: (until) => {
      setBackoffCalls.push(until)
    },
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

  return { deps, getQueue: () => queue, setBackoffCalls, backoffAttempts }
}

describe('Adversarial Stress Test: Pre-Wake Outbox & Gating Engine', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    backend.resetBackend()
    backend.state.transactions.clear()
    server.resetHandlers()
  })

  // =========================================================================
  // 1. BURST QUEUING STRESS TESTS
  // =========================================================================
  describe('1. Burst Queuing Stress Tests', () => {
    it('handles 100 rapid sequential and burst pre-wake transaction adds without loss or corruption', () => {
      let queue: QueuedOp[] = []
      const burstCount = 100

      for (let i = 0; i < burstCount; i++) {
        const id = `tx-burst-${i}`
        const payload = {
          id,
          date: '2026-11-09',
          description: `Burst Purchase #${i}`,
          category: i % 2 === 0 ? 'Food' : 'Transport',
          ledgerCategory: 'Essentials' as const,
          amount: -(i + 1) * 1.5,
        }
        queue = enqueue(queue, 'transaction', 'add', id, payload)
      }

      expect(queue).toHaveLength(burstCount)

      // Durably write to localStorage
      const success = setCachedJSON(CACHE_KEYS.pendingOperations, queue)
      expect(success).toBe(true)

      // Verify raw storage content is valid JSON and complete
      const rawStored = localStorage.getItem(CACHE_KEYS.pendingOperations)
      expect(rawStored).toBeTruthy()

      const restoredOps = getCachedOps()
      expect(restoredOps).toHaveLength(burstCount)

      // Assert integrity of all 100 transactions
      for (let i = 0; i < burstCount; i++) {
        const op = restoredOps[i]
        expect(op.id).toBeTruthy()
        expect(op.entity).toBe('transaction')
        expect(op.type).toBe('add')
        expect(op.targetId).toBe(`tx-burst-${i}`)
        expect(op.retryCount).toBe(0)
        expect(op.payload?.description).toBe(`Burst Purchase #${i}`)
        expect(op.payload?.amount).toBe(-(i + 1) * 1.5)
      }
    })

    it('preserves outbox consistency under rapid hook mutateQueueDurably calls', () => {
      const showToast = vi.fn()
      // Pre-wake: token is null (offline/unauthenticated before server wake)
      const { result, unmount } = renderHook(() =>
        useOutbox({
          token: null,
          lastUnlockedTimeRef: { current: Date.now() },
          setError: vi.fn(),
          showToast,
          onAuthError: vi.fn(),
          onLockError: vi.fn(),
          refresh: vi.fn().mockResolvedValue(undefined),
        })
      )

      // Burst queue 25 transactions through mutateQueueDurably
      act(() => {
        for (let i = 0; i < 25; i++) {
          const id = `tx-hook-burst-${i}`
          result.current.mutateQueueDurably(prev =>
            result.current.enqueue(prev, 'transaction', 'add', id, {
              id,
              date: '2026-11-09',
              description: `Hook Burst ${i}`,
              amount: -10 - i,
            })
          )
        }
      })

      // In-memory ref and state check
      expect(result.current.getPendingOps()).toHaveLength(25)

      // localStorage check
      const cached = getCachedOps()
      expect(cached).toHaveLength(25)
      expect(cached[24].targetId).toBe('tx-hook-burst-24')
      expect(showToast).not.toHaveBeenCalledWith(expect.stringMatching(/storage full/i), expect.anything(), expect.anything())

      unmount()
    })

    it('safely handles localStorage quota exhaustion during pre-wake queuing', () => {
      // Mock localStorage.setItem to simulate QuotaExceededError
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = vi.fn().mockImplementation(() => {
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      })

      try {
        const showToast = vi.fn()
        const { result, unmount } = renderHook(() =>
          useOutbox({
            token: null,
            lastUnlockedTimeRef: { current: Date.now() },
            setError: vi.fn(),
            showToast,
            onAuthError: vi.fn(),
            onLockError: vi.fn(),
            refresh: vi.fn().mockResolvedValue(undefined),
          })
        )

        expect(() => {
          act(() => {
            result.current.mutateQueueDurably(prev =>
              result.current.enqueue(prev, 'transaction', 'add', 'tx-quota-fail', { amount: -50 })
            )
          })
        }).toThrow(/Could not store this transaction on the device/i)

        unmount()
      } finally {
        Storage.prototype.setItem = originalSetItem
      }
    })
  })

  // =========================================================================
  // 2. COLD START & WAKE FAILURE SIMULATION (HTTP 502, 503, 504, 429)
  // =========================================================================
  describe('2. Cold Start / Server Wake Failure Simulation', () => {
    it('handles HTTP 502/503/504 on cold boot without dropping ops or incrementing retryCount', async () => {
      const statuses = [502, 503, 504]

      for (const status of statuses) {
        const queue: QueuedOp[] = [
          {
            id: `op-wake-${status}`,
            entity: 'transaction',
            type: 'add',
            targetId: `tx-wake-${status}`,
            payload: {
              id: `tx-wake-${status}`,
              date: '2026-11-09',
              description: `Cold boot test ${status}`,
              amount: -25.0,
            },
            createdAt: Date.now(),
            retryCount: 0,
            isCompleted: false,
          },
        ]

        // Intercept API with cold start gateway failure
        server.use(
          http.post('http://localhost/api/transactions', () => {
            return new HttpResponse(null, { status })
          })
        )

        const setErrorMock = vi.fn()
        const setBackoffMock = vi.fn()
        const addFailedOpMock = vi.fn()
        let backoffAttempt = 0

        const { deps } = makeDrainDeps(queue, {
          setError: setErrorMock,
          setBackoff: setBackoffMock,
          addFailedOp: addFailedOpMock,
          getBackoffAttempt: () => backoffAttempt,
          setBackoffAttempt: (att) => { backoffAttempt = att },
        })

        await drainQueue(deps)

        // 1. Operation MUST NOT be removed from queue
        expect(queue).toHaveLength(1)
        expect(queue[0].targetId).toBe(`tx-wake-${status}`)

        // 2. Operation retryCount MUST NOT increment (cold boot is not an application failure)
        expect(queue[0].retryCount).toBe(0)

        // 3. Operation MUST NOT be placed into failedOps
        expect(addFailedOpMock).not.toHaveBeenCalled()

        // 4. Backoff MUST be scheduled and backoffAttempt incremented
        expect(setBackoffMock).toHaveBeenCalled()
        expect(backoffAttempt).toBe(1)

        // 5. User-facing status reflects wake status
        expect(setErrorMock).toHaveBeenCalledWith('Sync pending: Server is offline or waking up...')
      }
    })

    it('schedules backoff on HTTP 429 without burning retryCount and drains cleanly upon wake recovery', async () => {
      const queue: QueuedOp[] = [
        {
          id: 'op-wake-recovery-1',
          entity: 'transaction',
          type: 'add',
          targetId: 'tx-wake-recovery-1',
          payload: {
            id: 'tx-wake-recovery-1',
            date: '2026-11-09',
            description: 'Recovery Groceries',
            amount: -30.0,
          },
          createdAt: Date.now(),
          retryCount: 0,
          isCompleted: false,
        },
      ]

      let callCount = 0
      server.use(
        http.post('http://localhost/api/transactions', () => {
          callCount++
          if (callCount === 1) {
            // Cold start container warming up
            return new HttpResponse(null, { status: 503 })
          }
          if (callCount === 2) {
            // Container busy
            return new HttpResponse(null, {
              status: 429,
              headers: { 'Retry-After': '2' },
            })
          }
          // Third call: awake and ready!
          const tx = {
            id: 'tx-wake-recovery-1',
            date: '2026-11-09',
            description: 'Recovery Groceries',
            amount: obfuscateAmount(-30.0),
          }
          backend.state.transactions.set('tx-wake-recovery-1', tx as any)
          return HttpResponse.json(tx)
        })
      )

      let backoffAttempt = 0
      let backoffUntil = 0
      const setErrorMock = vi.fn()

      const { deps } = makeDrainDeps(queue, {
        setError: setErrorMock,
        getBackoffUntil: () => backoffUntil,
        setBackoff: (until) => { backoffUntil = until },
        getBackoffAttempt: () => backoffAttempt,
        setBackoffAttempt: (att) => { backoffAttempt = att },
      })

      // Attempt 1: 503 Service Unavailable
      await drainQueue(deps)
      expect(queue).toHaveLength(1)
      expect(queue[0].retryCount).toBe(0)
      expect(backoffAttempt).toBe(1)
      expect(setErrorMock).toHaveBeenCalledWith('Sync pending: Server is offline or waking up...')

      // Fast forward past backoff
      backoffUntil = 0

      // Attempt 2: 429 Too Many Requests
      await drainQueue(deps)
      expect(queue).toHaveLength(1)
      expect(queue[0].retryCount).toBe(0)
      expect(backoffAttempt).toBe(2)
      expect(setErrorMock).toHaveBeenCalledWith('Sync pending: Server is busy; retrying...')

      // Fast forward past backoff
      backoffUntil = 0

      // Attempt 3: 200 OK (server awake)
      await drainQueue(deps)
      expect(queue).toHaveLength(0)
      expect(backoffAttempt).toBe(0) // Backoff attempts reset on success!
      expect(backend.state.transactions.has('tx-wake-recovery-1')).toBe(true)
    })
  })

  // =========================================================================
  // 3. IDEMPOTENCY & DEDUPLICATION REPLAY STRESS
  // =========================================================================
  describe('3. Idempotency & Deduplication Stress', () => {
    it('handles network cut after server commit: replays cleanly with HTTP 200 Existing and zero duplicates', async () => {
      const txId = 'tx-ack-loss-empirical-1'

      // Pre-populate backend as if the transaction was committed on the server,
      // but the network response dropped before the client could acknowledge it.
      backend.state.transactions.set(txId, {
        id: txId,
        date: '2026-11-09',
        description: 'Gas Station Fuel',
        category: 'Transport',
        ledgerCategory: 'Essentials',
        amount: obfuscateAmount(-42.5),
      } as any)

      const queue: QueuedOp[] = [
        {
          id: 'op-ack-loss-1',
          entity: 'transaction',
          type: 'add',
          targetId: txId,
          payload: {
            id: txId,
            date: '2026-11-09',
            description: 'Gas Station Fuel',
            category: 'Transport',
            ledgerCategory: 'Essentials',
            amount: -42.5,
          },
          createdAt: Date.now() - 5000,
          retryCount: 0,
          isCompleted: false,
        },
      ]

      const addRecentlyCompletedMock = vi.fn()
      const { deps } = makeDrainDeps(queue, {
        addRecentlyCompleted: addRecentlyCompletedMock,
      })

      // Client wakes up and reconnects, draining the unacknowledged queue
      await drainQueue(deps)

      // 1. Queue is drained completely without error
      expect(queue).toHaveLength(0)

      // 2. addRecentlyCompleted received the completed operation
      expect(addRecentlyCompletedMock).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: txId, isCompleted: true })
      )

      // 3. Exactly one record exists on backend
      expect(backend.state.transactions.size).toBe(1)
      const persisted = backend.state.transactions.get(txId)
      expect(persisted).toBeDefined()
      expect(deobfuscateAmount(persisted!.amount)).toBe(-42.5)
    })

    it('collapses rapid duplicate additions for identical targetId in queue algebra', () => {
      let queue: QueuedOp[] = []
      const targetId = 'tx-dup-target-1'

      // First add
      queue = enqueue(queue, 'transaction', 'add', targetId, {
        date: '2026-11-09',
        description: 'First Tap',
        amount: -10,
      })
      expect(queue).toHaveLength(1)

      // Rapid duplicate second tap with same targetId
      queue = enqueue(queue, 'transaction', 'add', targetId, {
        date: '2026-11-09',
        description: 'First Tap Updated',
        amount: -10,
      })

      // Queue MUST collapse into 1 operation rather than creating a duplicate
      expect(queue).toHaveLength(1)
      expect(queue[0].targetId).toBe(targetId)
      expect(queue[0].payload?.description).toBe('First Tap Updated')
    })

    it('falls back from failing bulkAdd to single-item dispatches and handles partial commits cleanly', async () => {
      // Clear backend for isolated test
      backend.state.transactions.clear()

      // Simulate 3 pre-wake transactions
      const tx1 = { id: 'tx-fallback-1', date: '2026-11-09', description: 'Item 1', amount: -5 }
      const tx2 = { id: 'tx-fallback-2', date: '2026-11-09', description: 'Item 2', amount: -15 }
      const tx3 = { id: 'tx-fallback-3', date: '2026-11-09', description: 'Item 3', amount: -25 }

      // Item 1 was already committed server-side before crash
      backend.state.transactions.set(tx1.id, {
        id: tx1.id,
        date: tx1.date,
        description: tx1.description,
        amount: obfuscateAmount(tx1.amount),
      } as any)

      let queue: QueuedOp[] = []
      queue = enqueue(queue, 'transaction', 'add', tx1.id, tx1)
      queue = enqueue(queue, 'transaction', 'add', tx2.id, tx2)
      queue = enqueue(queue, 'transaction', 'add', tx3.id, tx3)

      expect(queue).toHaveLength(3)

      // bulk-create endpoint fails (500)
      server.use(
        http.post('http://localhost/api/transactions/bulk-create', () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const { deps } = makeDrainDeps(queue)

      // Drain will attempt bulkAdd, catch failure, and fall through to single-op dispatches
      await drainQueue(deps)

      // All 3 transactions should be cleared from queue
      expect(queue).toHaveLength(0)

      // All 3 transactions exist on the server with zero duplicates
      expect(backend.state.transactions.size).toBe(3)
      expect(backend.state.transactions.has(tx1.id)).toBe(true)
      expect(backend.state.transactions.has(tx2.id)).toBe(true)
      expect(backend.state.transactions.has(tx3.id)).toBe(true)
    })
  })

  // =========================================================================
  // 4. APP REBOOT RESILIENCE & MULTI-CYCLE OFFLINE ACCUMULATION
  // =========================================================================
  describe('4. App Reboot Resilience Across Downtime', () => {
    it('survives multiple reboots while server is asleep and synchronizes completely upon waking', async () => {
      // Clear backend for isolated test
      backend.state.transactions.clear()

      // --- Boot Cycle 1 ---
      const tx1 = {
        id: 'tx-reboot-cycle-1',
        date: '2026-11-09',
        description: 'First Boot Item',
        category: 'Food',
        amount: -8.5,
      }
      const bootQueue1 = enqueue([], 'transaction', 'add', tx1.id, tx1)
      setCachedJSON(CACHE_KEYS.pendingOperations, bootQueue1)

      // Simulate App Reboot 1 (all memory wiped, restored from localStorage)
      const restored1 = getCachedOps()
      expect(restored1).toHaveLength(1)
      expect(restored1[0].targetId).toBe(tx1.id)

      // --- Boot Cycle 2: Add second item while still pre-wake ---
      const tx2 = {
        id: 'tx-reboot-cycle-2',
        date: '2026-11-09',
        description: 'Second Boot Item',
        category: 'Utilities',
        amount: -60.0,
      }
      const bootQueue2 = enqueue(restored1, 'transaction', 'add', tx2.id, tx2)
      setCachedJSON(CACHE_KEYS.pendingOperations, bootQueue2)

      // Simulate App Reboot 2 (all memory wiped again)
      const restored2 = getCachedOps()
      expect(restored2).toHaveLength(2)
      expect(restored2[0].targetId).toBe(tx1.id)
      expect(restored2[1].targetId).toBe(tx2.id)
      expect(restored2[0].retryCount).toBe(0)
      expect(restored2[1].retryCount).toBe(0)

      // --- Server Wakes Up ---
      const { deps } = makeDrainDeps(restored2)
      await drainQueue(deps)

      // Queue drained
      expect(restored2).toHaveLength(0)

      // Both transactions committed to server
      expect(backend.state.transactions.size).toBe(2)
      expect(backend.state.transactions.get(tx1.id)?.description).toBe('First Boot Item')
      expect(backend.state.transactions.get(tx2.id)?.description).toBe('Second Boot Item')

      // Update storage and assert empty pending ops
      setCachedJSON(CACHE_KEYS.pendingOperations, restored2)
      expect(getCachedOps()).toHaveLength(0)
    })
  })

  // =========================================================================
  // 5. ADVERSARIAL GATING & SENSITIVE MODE PROBING
  // =========================================================================
  describe('5. Adversarial Gating & Sensitive Mode Probing', () => {
    it('strictly forbids account reconciliation and loan actions when server is not awake', async () => {
      let queue: QueuedOp[] = []
      const showToast = vi.fn()
      const isServerAwakeRef = { current: false }

      // Account reconciliation
      const accountActions = createLedgerAccountActions({
        accounts: [{ id: 'acc-1', name: 'Checking', bucket: 'Essentials', kind: 'Bank', remaining: 100 } as any],
        guardSensitive: () => true,
        enqueue,
        mutateQueue: update => { queue = update(queue) },
        snapshotForUndo: vi.fn(),
        setConfirmModalData: vi.fn(),
        showToast,
        isServerAwakeRef,
      })

      accountActions.handleReconcileAccounts({
        bucket: 'Essentials',
        expectedBucketTotal: 100,
        operationId: 'op-rec-adversarial',
        targets: [],
      })

      expect(queue).toHaveLength(0)
      expect(showToast).toHaveBeenCalledWith(
        'Account reconciliation requires a live connection to verify current balances.',
        'Live connection required',
        'warning',
      )

      // Loan Repayments
      const loanActions = createLoanActions({
        loans: [{ id: 'loan-1', name: 'Auto Loan' } as Loan],
        recurringPayments: [] as RecurringPayment[],
        guardSensitive: () => true,
        enqueue,
        mutateQueue: update => { queue = update(queue) },
        snapshotForUndo: vi.fn(),
        setConfirmModalData: vi.fn(),
        showToast,
        isServerAwakeRef,
      })

      await loanActions.handleAdvanceRepayment('loan-1', 1)
      expect(queue).toHaveLength(0)

      await loanActions.handleFullSettlement('loan-1', 5000)
      expect(queue).toHaveLength(0)

      expect(showToast).toHaveBeenCalledWith(
        'Loan repayment actions require a live connection to verify current amortization.',
        'Live connection required',
        'warning',
      )
    })

    it('enforces sensitive mode shielding on transaction edit while allowing create pre-wake', async () => {
      const dispatch = vi.fn()
      const onAddTransaction = vi.fn().mockResolvedValue(undefined)
      const onUpdateTransaction = vi.fn().mockResolvedValue(undefined)

      const accounts: LedgerAccount[] = [
        { id: 'acc-1', name: 'Checking', bucket: 'Essentials', kind: 'Bank', remaining: 100, isArchived: false, createdAt: '', updatedAt: '' },
      ]

      // 1. Adversarially attempt to edit an existing transaction while sensitive mode is active
      const editState: any = {
        mode: 'edit',
        editingId: 'tx-sensitive-edit-target',
        description: 'Edit Attempt',
        amount: '20.00',
        date: '2026-11-09',
        transactionType: 'outflow',
        ledgerCategory: 'Essentials',
        accountId: 'acc-1',
      }

      const { result: editResult, unmount: unmountEdit } = renderHook(() =>
        useTransactionFormSubmit({
          state: editState,
          dispatch,
          accountsLoading: false,
          accounts,
          hideSensitive: true,
          sensitivePreferenceStatus: 'pending',
          resolveAcceptedTopUp: () => 0,
          savedTopUpMovedAcrossCycles: false,
          topUpOffer: null,
          documentsFieldRef: { current: null },
          isRecoveryCycleDate: false,
          stabilityTopUpContext: undefined,
          essentialsAlloc: 50,
          growthAlloc: 20,
          stabilityAlloc: 20,
          rewardsAlloc: 10,
          stabilityBalance: 1000,
          stabilityTarget: 2000,
          stabilityOverflowRedirect: 'Essentials',
          todayDate: '2026-11-09',
          clearFormDraft: vi.fn(),
          scanner: { clearScan: vi.fn() },
          cycleDay: 1,
          onAddTransaction,
          onUpdateTransaction,
        })
      )

      await act(async () => {
        await editResult.current.handleSubmit({ preventDefault: vi.fn(), currentTarget: {} } as any)
      })

      // Edit is blocked!
      expect(onUpdateTransaction).not.toHaveBeenCalled()
      expect(dispatch).toHaveBeenCalledWith({
        type: 'SET_ERRORS',
        errors: { submit: 'Finishing security check…' },
      })
      unmountEdit()

      // 2. Attempt to create a new transaction while sensitive mode is active
      const createState: any = {
        ...editState,
        mode: 'create',
        editingId: undefined,
      }

      const { result: createResult, unmount: unmountCreate } = renderHook(() =>
        useTransactionFormSubmit({
          state: createState,
          dispatch,
          accountsLoading: false,
          accounts,
          hideSensitive: true,
          sensitivePreferenceStatus: 'pending',
          resolveAcceptedTopUp: () => 0,
          savedTopUpMovedAcrossCycles: false,
          topUpOffer: null,
          documentsFieldRef: { current: null },
          isRecoveryCycleDate: false,
          stabilityTopUpContext: undefined,
          essentialsAlloc: 50,
          growthAlloc: 20,
          stabilityAlloc: 20,
          rewardsAlloc: 10,
          stabilityBalance: 1000,
          stabilityTarget: 2000,
          stabilityOverflowRedirect: 'Essentials',
          todayDate: '2026-11-09',
          clearFormDraft: vi.fn(),
          scanner: { clearScan: vi.fn() },
          cycleDay: 1,
          onAddTransaction,
          onUpdateTransaction,
        })
      )

      await act(async () => {
        await createResult.current.handleSubmit({ preventDefault: vi.fn(), currentTarget: {} } as any)
      })

      // Create succeeds!
      expect(onAddTransaction).toHaveBeenCalledTimes(1)
      unmountCreate()
    })
  })
})
