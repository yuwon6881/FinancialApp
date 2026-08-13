import { describe, expect, it } from 'vitest'
import type { ActiveRecurringPayment, RecurringPayment, Transaction } from '../types'
import { buildBillTimelineModel } from './billTimeline'

const pendingPayment: ActiveRecurringPayment = {
  id: 'occurrence-1',
  recurringPaymentId: 'bill-1',
  name: 'Internet',
  amount: 120,
  category: 'Utilities',
  ledgerCategory: 'Essentials',
  dueDate: '2026-08-15',
  dueDay: 15,
  isPaid: false,
  isDiscarded: false,
  status: 'Pending',
}

const baseOptions = {
  activeRecurringPayments: [pendingPayment],
  selectedMonth: 'Aug',
  selectedYear: 2026,
  cycleDay: 1,
  fallbackDate: new Date(2026, 7, 1),
}

describe('buildBillTimelineModel', () => {
  it('keeps current-cycle server status authoritative', () => {
    const transaction: Transaction = {
      id: 'tx-1',
      date: '2026-08-15',
      description: 'Internet',
      amount: -120,
      category: 'Utilities',
      ledgerCategory: 'Essentials',
    }

    const result = buildBillTimelineModel({ ...baseOptions, transactions: [transaction] })

    expect(result.processedPayments[0].status).toBe('Pending')
  })

  it('retains the legacy transaction fallback when cached status is absent', () => {
    const legacy = { ...pendingPayment, status: undefined } as unknown as ActiveRecurringPayment
    const transaction: Transaction = {
      id: 'tx-1',
      date: '2026-08-15',
      description: 'Internet',
      amount: -120,
      category: 'Utilities',
      ledgerCategory: 'Essentials',
    }

    const result = buildBillTimelineModel({ ...baseOptions, activeRecurringPayments: [legacy], transactions: [transaction] })

    expect(result.processedPayments[0]).toMatchObject({ status: 'Paid', paidDate: '2026-08-15' })
  })

  it('synthesizes only the annual bill matching the future cycle month', () => {
    const annual: RecurringPayment = {
      id: 'annual-1',
      name: 'Insurance',
      amount: 600,
      category: 'Insurance',
      ledgerCategory: 'Essentials',
      frequency: 'Annually',
      nextDueDate: '2026-09-30',
      dueDate: 31,
      startDate: '2026-09-01',
      active: true,
      paymentMode: 'Manual',
    }

    const result = buildBillTimelineModel({ ...baseOptions, allPayments: [annual], cycleOffset: 1 })

    expect(result.processedPayments).toHaveLength(1)
    expect(result.processedPayments[0]).toMatchObject({ name: 'Insurance', dueDate: '2026-09-30', status: 'Pending' })
  })

  it('groups bills sharing a due date and totals absolute amounts', () => {
    const second = { ...pendingPayment, id: 'occurrence-2', recurringPaymentId: 'bill-2', amount: 80 }

    const result = buildBillTimelineModel({ ...baseOptions, activeRecurringPayments: [pendingPayment, second] })

    expect(result.cycleTotal).toBe(200)
    expect(result.timelineNodes).toHaveLength(1)
    expect(result.timelineNodes[0].bills).toHaveLength(2)
  })
})
