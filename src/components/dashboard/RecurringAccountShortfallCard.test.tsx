import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RecurringAccountShortfall } from '../../types'
import { RecurringAccountShortfallCard } from './RecurringAccountShortfallCard'

const formatSensitive = (val: number) => `$${val.toFixed(2)}`

const sampleShortfall: RecurringAccountShortfall = {
  recurringPaymentId: 'rec-rent',
  name: 'Rent',
  amount: 1200,
  dueDate: '2026-07-20',
  dueDay: 20,
  offsetDays: 1,
  accountId: 'acc-main',
  accountName: 'Checking Account',
  accountBalance: 300,
  shortfall: 900,
}

describe('RecurringAccountShortfallCard', () => {
  it('renders nothing when shortfalls is undefined or empty', () => {
    const { container: c1 } = render(
      <RecurringAccountShortfallCard shortfalls={undefined} formatSensitive={formatSensitive} />
    )
    expect(c1.innerHTML).toBe('')

    const { container: c2 } = render(
      <RecurringAccountShortfallCard shortfalls={[]} formatSensitive={formatSensitive} />
    )
    expect(c2.innerHTML).toBe('')
  })

  it('renders shortfall warning with Due tomorrow badge for offsetDays = 1', () => {
    render(
      <RecurringAccountShortfallCard
        shortfalls={[sampleShortfall]}
        formatSensitive={formatSensitive}
      />
    )

    expect(screen.getByText('Rent auto-deduct shortfall')).toBeTruthy()
    expect(screen.getByText('Due tomorrow')).toBeTruthy()
    expect(screen.getByText(/Checking Account has \$300\.00, but Rent needs \$1200\.00/)).toBeTruthy()
    expect(screen.getByText(/Transfer at least \$900\.00 to avoid a missed auto-deduction/)).toBeTruthy()
  })

  it('renders Due today badge for offsetDays = 0', () => {
    render(
      <RecurringAccountShortfallCard
        shortfalls={[{ ...sampleShortfall, offsetDays: 0 }]}
        formatSensitive={formatSensitive}
      />
    )

    expect(screen.getByText('Due today')).toBeTruthy()
  })

  it('renders Due in 3 days badge for offsetDays = 3', () => {
    render(
      <RecurringAccountShortfallCard
        shortfalls={[{ ...sampleShortfall, offsetDays: 3 }]}
        formatSensitive={formatSensitive}
      />
    )

    expect(screen.getByText('Due in 3 days')).toBeTruthy()
  })

  it('shows other shortfalls count when multiple items are short', () => {
    const secondShortfall: RecurringAccountShortfall = {
      recurringPaymentId: 'rec-wifi',
      name: 'Internet',
      amount: 100,
      dueDate: '2026-07-22',
      dueDay: 22,
      offsetDays: 3,
      accountId: 'acc-main',
      accountName: 'Checking Account',
      accountBalance: 300,
      shortfall: 50,
    }

    render(
      <RecurringAccountShortfallCard
        shortfalls={[sampleShortfall, secondShortfall]}
        formatSensitive={formatSensitive}
      />
    )

    expect(screen.getByText(/1 other auto-deduction is also short on funds/)).toBeTruthy()
  })

  it('triggers onTransferMoney and onNavigateToRecurring callbacks', () => {
    const onTransfer = vi.fn()
    const onRecurring = vi.fn()

    render(
      <RecurringAccountShortfallCard
        shortfalls={[sampleShortfall]}
        formatSensitive={formatSensitive}
        onTransferMoney={onTransfer}
        onNavigateToRecurring={onRecurring}
      />
    )

    const transferBtn = screen.getByRole('button', { name: /Transfer money/i })
    fireEvent.click(transferBtn)
    expect(onTransfer).toHaveBeenCalledTimes(1)

    const viewBillBtn = screen.getByRole('button', { name: /View bill/i })
    fireEvent.click(viewBillBtn)
    expect(onRecurring).toHaveBeenCalledWith('rec-rent')
  })
})
