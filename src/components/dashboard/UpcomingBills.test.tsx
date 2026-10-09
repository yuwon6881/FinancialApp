import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActiveRecurringPayment } from '../../types'
import { UpcomingBills } from './UpcomingBills'

const bill = (overrides: Partial<ActiveRecurringPayment>): ActiveRecurringPayment => ({
  id: 'arp',
  recurringPaymentId: 'rp',
  name: 'Bill',
  amount: 10,
  category: 'Utilities',
  ledgerCategory: 'Essentials',
  dueDate: '2026-08-20',
  isPaid: false,
  isDiscarded: false,
  status: 'Pending',
  ...overrides,
})

const today = new Date(2026, 7, 15)

describe('UpcomingBills', () => {
  it('lists outstanding bills soonest first and flags the overdue ones', () => {
    render(
      <UpcomingBills
        today={today}
        currency="USD"
        hideSensitive={false}
        onOpenBill={vi.fn()}
        onOpenAll={vi.fn()}
        payments={[
          bill({ id: 'a', name: 'Internet', dueDate: '2026-08-20' }),
          bill({ id: 'b', name: 'Rent', dueDate: '2026-08-13', status: 'PartiallyPaid', remainingAmount: 400 }),
          bill({ id: 'c', name: 'Gym', dueDate: '2026-08-16' }),
          bill({ id: 'd', name: 'Music', status: 'Paid', isPaid: true }),
        ]}
      />,
    )

    const rows = within(screen.getByRole('list')).getAllByRole('button')
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('Rent'),
      expect.stringContaining('Gym'),
      expect.stringContaining('Internet'),
    ])
    expect(rows[0].textContent).toContain('Overdue · 2 days')
    // A part-paid bill quotes what is still owed, not its full amount.
    expect(rows[0].textContent).toContain('$400.00')
    expect(rows[1].textContent).toContain('Due tomorrow')
    expect(screen.queryByText('Music')).toBeNull()
    expect(screen.getByText('3 unpaid')).toBeTruthy()
  })

  it('opens the bill that was tapped', () => {
    const onOpenBill = vi.fn()
    render(
      <UpcomingBills
        today={today}
        currency="USD"
        hideSensitive={false}
        onOpenBill={onOpenBill}
        onOpenAll={vi.fn()}
        payments={[bill({ recurringPaymentId: 'rp-internet', name: 'Internet' })]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Internet/ }))
    expect(onOpenBill).toHaveBeenCalledWith('rp-internet')
  })

  it('draws nothing once every bill is settled', () => {
    const { container } = render(
      <UpcomingBills
        today={today}
        currency="USD"
        hideSensitive={false}
        onOpenBill={vi.fn()}
        onOpenAll={vi.fn()}
        payments={[bill({ status: 'Paid', isPaid: true })]}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('masks amounts in sensitive mode', () => {
    render(
      <UpcomingBills
        today={today}
        currency="USD"
        hideSensitive
        onOpenBill={vi.fn()}
        onOpenAll={vi.fn()}
        payments={[bill({ amount: 99 })]}
      />,
    )
    expect(screen.queryByText(/99/)).toBeNull()
  })
})
