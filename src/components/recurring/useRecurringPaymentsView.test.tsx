import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RecurringPayment } from '../../types'
import { useRecurringPaymentsView } from './useRecurringPaymentsView'

const payment = (overrides: Partial<RecurringPayment> = {}): RecurringPayment => ({
  id: 'rp-1',
  name: 'Internet',
  amount: -60,
  frequency: 'Monthly',
  category: 'Bills',
  ledgerCategory: 'Essentials',
  accountId: 'acct-1',
  nextDueDate: '2099-08-20',
  dueDate: 20,
  startDate: '2026-01-20',
  active: true,
  paymentMode: 'Manual',
  ...overrides,
})

describe('useRecurringPaymentsView', () => {
  it('excludes an ended payment from the active count and committed total', () => {
    const { result } = renderHook(() => useRecurringPaymentsView({
      payments: [
        payment({ id: 'current' }),
        payment({ id: 'ended', endDate: '2000-01-01' }),
      ],
      accounts: [],
      categories: [],
      hideSensitive: false,
      currency: 'MYR',
      activeSyncId: null,
      deletingId: null,
      onAddPayment: () => {},
      onUpdatePayment: () => {},
    }))

    expect(result.current.activeCount).toBe(1)
    expect(result.current.totalCommittedMonthly).toBe(60)
  })
})
