import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LOAN_INTEREST_METHOD_OPTIONS, loanInterestMethodCopy } from '../../../lib/loanTerms'
import type { Loan, RecurringPayment } from '../../../types'
import { LoanFormSheet } from './LoanFormSheet'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const bill = (id: string, name: string): RecurringPayment => ({
  id,
  name,
  amount: -100,
  frequency: 'Monthly',
  category: 'Bills',
  ledgerCategory: 'Essentials',
  accountId: 'acct-essentials',
  dueDate: id === 'bill-a' ? 1 : 15,
  startDate: id === 'bill-a' ? '2026-01-01' : '2026-01-15',
  nextDueDate: '2026-09-01',
  active: true,
  paymentMode: 'Manual',
})

const editingLoan: Loan = {
  id: 'loan-car',
  name: 'Car loan',
  recurringPaymentId: 'bill-a',
  openingPrincipal: 1000,
  trackingStartDate: '2026-01-01',
  annualRatePercent: 5,
  termPeriods: 12,
  interestMethod: 'ReducingBalance',
  recurringPaymentExists: true,
  scheduleFrequency: 'Monthly',
  scheduleDueDay: 1,
  scheduleStartDate: '2026-01-01',
  scheduleStatus: 'Complete',
  snapshot: {
    outstandingBalance: 900,
    scheduledPayment: 100,
    totalScheduledInterest: 20,
    totalInterestPaid: 5,
    payments: [],
    futureSchedule: [],
  },
}

describe('LoanFormSheet', () => {
  it('allows relinking to an unlinked recurring bill and submits the replacement id', () => {
    const onSave = vi.fn()
    render(
      <LoanFormSheet
        isOpen
        editingLoan={editingLoan}
        payments={[bill('bill-a', 'Old bill'), bill('bill-b', 'Replacement bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: /^Linked recurring bill/ }))
    fireEvent.click(screen.getByRole('option', { name: /Replacement bill/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurringPaymentId: 'bill-b' }))
    expect(screen.queryByText(/schedule details are required/i)).toBeNull()
  })

  it('renders all four methods and wires each explanation through aria-describedby', () => {
    render(
      <LoanFormSheet
        isOpen
        editingLoan={editingLoan}
        payments={[bill('bill-a', 'Old bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const methodSelect = screen.getByRole('combobox', { name: /^Interest method/ })
    expect(methodSelect.getAttribute('aria-describedby')).toBeTruthy()
    for (const option of LOAN_INTEREST_METHOD_OPTIONS) {
      fireEvent.click(methodSelect)
      fireEvent.click(screen.getByRole('option', { name: option.label }))
      expect(screen.getByText(loanInterestMethodCopy(option.value).hint)).not.toBeNull()
    }
  })

  it('round-trips a monthly entry and keeps the equivalent payment preview', () => {
    const onSave = vi.fn()
    const monthlyLoan = { ...editingLoan, annualRatePercent: 17.04, rateBasis: 'Monthly' as const }
    const { unmount } = render(
      <LoanFormSheet
        isOpen
        editingLoan={monthlyLoan}
        payments={[bill('bill-a', 'Old bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    const rateInput = screen.getByRole('spinbutton', { name: /^Interest rate/ })
    expect((rateInput as HTMLInputElement).value).toBe('1.42')
    expect(screen.getByText("That's 17.04% a year.")).not.toBeNull()
    const monthlyPreview = screen.getByText(/Estimated payment:/).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ annualRatePercent: 17.04, rateBasis: 'Monthly' }))

    fireEvent.click(screen.getByRole('combobox', { name: /^Interest rate/ }))
    fireEvent.click(screen.getByRole('option', { name: 'per year' }))
    expect(screen.getByText(/Estimated payment:/).textContent).toBe(monthlyPreview)
    unmount()
  })

  it('rejects a monthly entry whose derived annual rate exceeds the cap', () => {
    const onSave = vi.fn()
    render(
      <LoanFormSheet
        isOpen
        editingLoan={{ ...editingLoan, rateBasis: 'Monthly' }}
        payments={[bill('bill-a', 'Old bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByRole('spinbutton', { name: /^Interest rate/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(screen.getByRole('alert').textContent).toContain('8.3333% a month')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('accepts a nine percent yearly entry', () => {
    const onSave = vi.fn()
    render(
      <LoanFormSheet
        isOpen
        editingLoan={editingLoan}
        payments={[bill('bill-a', 'Old bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByRole('spinbutton', { name: /^Interest rate/ }), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ annualRatePercent: 9, rateBasis: 'Yearly' }))
  })

  it('offers years and months while serializing a monthly duration as payment periods', () => {
    const onSave = vi.fn()
    render(
      <LoanFormSheet
        isOpen
        editingLoan={editingLoan}
        payments={[bill('bill-a', 'Old bill')]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    expect((screen.getByRole('spinbutton', { name: /^Loan length/ }) as HTMLInputElement).value).toBe('1')
    fireEvent.change(screen.getByRole('spinbutton', { name: /^Loan length/ }), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ termPeriods: 24 }))
  })

  it('derives the payment count when a newly linked bill already has an end date', () => {
    const onSave = vi.fn()
    const replacement = { ...bill('bill-b', 'Replacement bill'), dueDate: 1, startDate: '2026-01-01', endDate: '2026-06-01' }
    render(
      <LoanFormSheet
        isOpen
        editingLoan={editingLoan}
        payments={[bill('bill-a', 'Old bill'), replacement]}
        linkedPaymentIds={new Set(['bill-a'])}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: /^Linked recurring bill/ }))
    fireEvent.click(screen.getByRole('option', { name: /Replacement bill/ }))
    expect((screen.getByRole('spinbutton', { name: /^Loan length/ }) as HTMLInputElement).value).toBe('6')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurringPaymentId: 'bill-b', termPeriods: 6 }))
  })
})
