import { describe, expect, it, vi } from 'vitest'
import type { PendingNotification, RecurringPayment } from '../../types'
import type { QueuedOp } from '../../lib/outbox'
import { createRecurringActions } from './recurringActions'

/**
 * A bill authored before account attribution carries an empty account id rather than a null one.
 * Forwarding that empty string asked the server to settle into an account named "", which came
 * back as "account not assigned" — and nothing the account review could offer would satisfy it.
 * Queued as a missing account instead, the outbox's placement pass fills it in or asks.
 */
describe('recurring settlement account attribution', () => {
  const legacyBill: RecurringPayment = {
    id: 'bill-1',
    name: 'Internet',
    amount: 100,
    category: 'Bills',
    ledgerCategory: 'Essentials',
    frequency: 'Monthly',
    startDate: '2026-01-01',
    dueDate: 1,
    paymentMode: 'Manual',
    active: true,
    nextDueDate: '2026-09-01',
    accountId: '',
  }

  const notification: PendingNotification = {
    id: 'noti-1',
    recurringPaymentId: 'bill-1',
    name: 'Internet',
    amount: 100,
    billingDate: '2026-09-01',
    category: 'Bills',
    ledgerCategory: 'Essentials',
  } as PendingNotification

  function createHarness(payments: RecurringPayment[]) {
    const queued: QueuedOp[] = []
    const actions = createRecurringActions({
      allRecurringPayments: payments,
      guardSensitive: () => true,
      formatSensitive: (value: number) => String(value),
      toOutboxPayload: (value: object) => value as never,
      mutateQueue: (reducer: (queue: QueuedOp[]) => QueuedOp[]) => { queued.push(...reducer([])) },
      snapshotForUndo: vi.fn(),
      setConfirmModalData: vi.fn(),
      showToast: vi.fn(),
    } as unknown as Parameters<typeof createRecurringActions>[0])
    return { actions, queued }
  }

  it('queues a bill with no account as needing one rather than as an empty account', () => {
    const { actions, queued } = createHarness([legacyBill])

    actions.handleConfirmSubscription(notification, '2026-09-01')

    const payload = queued[0].payload as Record<string, unknown>
    expect(payload.accountId).toBeUndefined()
    expect((payload.optimisticTransaction as Record<string, unknown>).accountId).toBeUndefined()
  })

  it('keeps paying early from a bill with no account out of the empty-account trap', () => {
    const { actions, queued } = createHarness([legacyBill])

    actions.handlePayEarly('bill-1')

    const payload = queued[0].payload as Record<string, unknown>
    expect(payload.accountId).toBeUndefined()
  })

  it('still settles into the occurrence’s own frozen account when it has one', () => {
    const { actions, queued } = createHarness([{ ...legacyBill, accountId: 'acc-new' }])

    actions.handleConfirmSubscription({ ...notification, accountId: 'acc-frozen' }, '2026-09-01')

    expect((queued[0].payload as Record<string, unknown>).accountId).toBe('acc-frozen')
  })

  it('falls back to the bill’s account for an occurrence with no snapshot', () => {
    const { actions, queued } = createHarness([{ ...legacyBill, accountId: 'acc-main' }])

    actions.handleConfirmSubscription(notification, '2026-09-01')

    expect((queued[0].payload as Record<string, unknown>).accountId).toBe('acc-main')
  })
})
