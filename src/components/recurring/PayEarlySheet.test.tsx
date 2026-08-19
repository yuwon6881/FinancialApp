import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PayEarlySheet } from './PayEarlySheet'
import type { LedgerAccount, RecurringPayment } from '../../types'

const samplePayment: RecurringPayment = {
  id: 'rp-electricity',
  name: 'Electricity',
  amount: 250,
  category: 'Utilities',
  ledgerCategory: 'Essentials',
  frequency: 'Monthly',
  startDate: '2026-01-01',
  dueDate: 1,
  paymentMode: 'Manual',
  active: true,
  nextDueDate: '2026-09-01',
  accountId: 'acc-main',
}

const autoDeductPayment: RecurringPayment = {
  ...samplePayment,
  id: 'rp-direct-debit',
  paymentMode: 'AutoDeduct',
}

const sampleAccounts: LedgerAccount[] = [
  { id: 'acc-main', name: 'Main Checking', bucket: 'Essentials', kind: 'Bank', remaining: 5000, isArchived: false, createdAt: '', updatedAt: '' },
  { id: 'acc-savings', name: 'Savings', bucket: 'Stability', kind: 'Bank', remaining: 10000, isArchived: false, createdAt: '', updatedAt: '' },
]

describe('PayEarlySheet', () => {
  it('renders scheduled amount and submits full payment by default', async () => {
    const onPayEarly = vi.fn()
    const onClose = vi.fn()

    render(
      <PayEarlySheet
        isOpen={true}
        payment={samplePayment}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={onClose}
        onPayEarly={onPayEarly}
      />
    )

    expect(screen.getByText('Pay Electricity early')).toBeDefined()
    expect(screen.getByText('Due on 2026-09-01')).toBeDefined()
    expect(screen.getByText('Pay now (RM 250.00)')).toBeDefined()

    const payButton = screen.getByRole('button', { name: /Pay now/i })
    fireEvent.click(payButton)

    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', undefined, 'acc-main')
  })

  it('allows switching to part amount mode and entering partial payment', async () => {
    const onPayEarly = vi.fn()
    const onClose = vi.fn()

    render(
      <PayEarlySheet
        isOpen={true}
        payment={samplePayment}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={onClose}
        onPayEarly={onPayEarly}
      />
    )

    const partTab = screen.getByRole('button', { name: 'Pay part amount' })
    fireEvent.click(partTab)

    const input = screen.getByPlaceholderText('0.00')
    fireEvent.change(input, { target: { value: '100' } })

    expect(screen.getByText('Paying now')).toBeDefined()
    expect(screen.getByText('Still due')).toBeDefined()

    const payButton = screen.getByRole('button', { name: /Pay now/i })
    fireEvent.click(payButton)

    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', 100, 'acc-main')
  })

  it('shows warning when payment mode is AutoDeduct', () => {
    render(
      <PayEarlySheet
        isOpen={true}
        payment={autoDeductPayment}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={vi.fn()}
        onPayEarly={vi.fn()}
      />
    )

    expect(screen.getByText(/This bill is deducted automatically/i)).toBeDefined()
  })
})
