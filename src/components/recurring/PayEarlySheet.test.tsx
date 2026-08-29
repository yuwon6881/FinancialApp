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

    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', 250, 'acc-main', true)
  })

  it('shows the assigned account instead of offering a choice the server would refuse', () => {
    render(
      <PayEarlySheet
        isOpen={true}
        payment={samplePayment}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={vi.fn()}
        onPayEarly={vi.fn()}
      />
    )

    // The bill settles in the account it is scheduled against; a picker here only invited a
    // choice that syncs and then fails.
    expect(screen.getByText('Main Checking')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByText('Savings')).toBeNull()
  })

  it('asks a bill with no account of its own to name one in its own bucket', () => {
    const onPayEarly = vi.fn()
    const legacyPayment: RecurringPayment = { ...samplePayment, accountId: '' }

    render(
      <PayEarlySheet
        isOpen={true}
        payment={legacyPayment}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={vi.fn()}
        onPayEarly={onPayEarly}
      />
    )

    // Bills authored before account attribution carry no account. The choice is real here, but
    // only across the bill's own bucket -- Savings sits in Stability and must not be offered.
    const button = screen.getByRole('button', { name: /Pay now/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.queryByText('Savings')).toBeNull()

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'Main Checking' }))

    fireEvent.click(screen.getByRole('button', { name: /Pay now/i }))
    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', 250, 'acc-main', true)
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

    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', 100, 'acc-main', false)
  })

  it('uses only the amount still due for a partially paid occurrence', () => {
    const onPayEarly = vi.fn()
    render(
      <PayEarlySheet
        isOpen
        payment={samplePayment}
        occurrence={{
          id: 'occ-part', recurringPaymentId: samplePayment.id, name: samplePayment.name,
          amount: 250, paidAmount: 100, remainingAmount: 150, category: samplePayment.category,
          ledgerCategory: samplePayment.ledgerCategory, dueDate: samplePayment.nextDueDate!,
          status: 'PartiallyPaid', isPaid: false, isDiscarded: false,
        }}
        accounts={sampleAccounts}
        currency="MYR"
        onClose={vi.fn()}
        onPayEarly={onPayEarly}
      />,
    )

    expect(screen.getByText('Already recorded')).toBeDefined()
    expect(screen.getByText('Pay now (RM 150.00)')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Pay now/i }))
    expect(onPayEarly).toHaveBeenCalledWith('rp-electricity', 150, 'acc-main', true)
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
