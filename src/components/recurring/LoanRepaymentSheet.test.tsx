import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerAccount, Loan, RecurringPayment } from '../../types'
import { LoanRepaymentSheet } from './LoanRepaymentSheet'

const previewAdvanceRepayment = vi.fn()
vi.mock('../../lib/api/loans', () => ({
  previewAdvanceRepayment: (...args: unknown[]) => previewAdvanceRepayment(...args),
}))

const loan: Loan = {
  id: 'loan-1', name: 'Car loan', recurringPaymentId: 'bill-1', openingPrincipal: 1000,
  trackingStartDate: '2026-01-01', annualRatePercent: 0, termPeriods: 10,
  interestMethod: 'ReducingBalance', scheduleFrequency: 'Monthly', scheduleDueDay: 1,
  scheduleStartDate: '2026-01-01', scheduleStatus: 'Complete', recurringPaymentExists: true,
  recurringPaymentName: 'Car bill', snapshot: {
    outstandingBalance: 1000, scheduledPayment: 100, totalScheduledInterest: 0,
    totalInterestPaid: 0, payments: [], nextPayment: null,
    futureSchedule: Array.from({ length: 6 }, (_, index) => ({
      occurrenceDate: `2026-${String(index + 1).padStart(2, '0')}-01`, payment: 100,
      interest: 0, principal: 100, balanceAfter: 900 - index * 100,
    })),
  },
}

const payment: RecurringPayment = {
  id: 'bill-1', name: 'Car bill', amount: 100, category: 'Transport', ledgerCategory: 'Essentials',
  frequency: 'Monthly', startDate: '2026-01-01', dueDate: 1, paymentMode: 'Manual',
  accountId: 'account-1', active: true, nextDueDate: '2026-01-01',
}

const accounts: LedgerAccount[] = [
  {
    id: 'account-1', name: 'Main account', bucket: 'Essentials', kind: 'Bank', remaining: 2000,
    isArchived: false, createdAt: '', updatedAt: '',
  },
  {
    id: 'account-2', name: 'Growth account', bucket: 'Growth', kind: 'Bank', remaining: 500,
    isArchived: false, createdAt: '', updatedAt: '',
  },
]

describe('LoanRepaymentSheet', () => {
  beforeEach(() => {
    previewAdvanceRepayment.mockReset()
    previewAdvanceRepayment.mockImplementation((_loanId: string, cycles: number) => Promise.resolve({
      cyclesCount: cycles,
      previewFingerprint: `fingerprint-${cycles}`,
      totalAmount: cycles * 100,
      occurrences: Array.from({ length: cycles }, (_, index) => ({
        occurrenceDate: `2026-${String(index + 1).padStart(2, '0')}-01`, payment: 100,
        interest: 0, principal: 100, balanceAfter: 900 - index * 100,
      })),
    }))
  })

  it('accepts a typed cycle count and requests only the latest debounced preview', async () => {
    const onAdvanceRepayment = vi.fn().mockResolvedValue(undefined)
    render(
      <LoanRepaymentSheet
        isOpen loan={loan} payment={payment} accounts={accounts} currency="MYR"
        onClose={vi.fn()} onAdvanceRepayment={onAdvanceRepayment} onFullSettlement={vi.fn()}
      />,
    )
    await waitFor(() => expect(previewAdvanceRepayment).toHaveBeenCalledWith('loan-1', 1, expect.any(AbortSignal)))
    previewAdvanceRepayment.mockClear()

    const input = screen.getByRole('spinbutton', { name: 'Number of instalments to pay' })
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.change(input, { target: { value: '10' } })

    await waitFor(() => expect(previewAdvanceRepayment).toHaveBeenCalledTimes(1))
    expect(previewAdvanceRepayment).toHaveBeenCalledWith('loan-1', 10, expect.any(AbortSignal))
    const payButton = await screen.findByRole('button', { name: /Pay 10 cycles/ }) as HTMLButtonElement
    await waitFor(() => expect(payButton.disabled).toBe(false))
    fireEvent.click(payButton)
    await waitFor(() => expect(onAdvanceRepayment).toHaveBeenCalledWith('loan-1', 10, 'account-1', 'fingerprint-10'))
  })

  it('offers every open account and keeps the server preview while switching repayment tabs', async () => {
    render(
      <LoanRepaymentSheet
        isOpen loan={loan} payment={payment} accounts={accounts} currency="MYR"
        onClose={vi.fn()} onAdvanceRepayment={vi.fn()} onFullSettlement={vi.fn()}
      />,
    )

    await waitFor(() => expect(previewAdvanceRepayment).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('combobox', { name: 'Pay from account' }))
    expect(screen.getByRole('option', { name: 'Growth account (Growth)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: 'Growth account (Growth)' }))

    fireEvent.click(screen.getByRole('button', { name: 'Full settlement' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advance cycles' }))

    await waitFor(() => expect(previewAdvanceRepayment).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('combobox', { name: 'Pay from account' }).textContent).toContain('Growth account')
  })
})
