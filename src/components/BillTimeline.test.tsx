import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { BillTimeline } from './BillTimeline'
import type { ActiveRecurringPayment, Transaction } from '../types'

vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title?: React.ReactNode }) =>
    isOpen ? (
      <div data-testid="bottom-sheet">
        <div data-testid="sheet-title">{title}</div>
        {children}
      </div>
    ) : null,
}))

vi.mock('./ui/Card', () => ({
  Card: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div className={className} onClick={onClick}>{children}</div>
  ),
}))

describe('BillTimeline', () => {
  const sampleActiveRecurring: ActiveRecurringPayment[] = [
    {
      id: 'sub-chatgpt',
      recurringPaymentId: 'rp-chatgpt',
      name: 'ChatGPT Plus',
      amount: 95.99,
      category: 'Entertainment',
      ledgerCategory: 'Essentials',
      dueDate: '2026-08-27',
      dueDay: 27,
      isPaid: false,
      isDiscarded: false,
      status: 'Pending',
    },
  ]

  const unrelatedTxInSameCategory: Transaction = {
    id: 'tx-ktv',
    date: '2026-08-29',
    description: 'KTV',
    amount: 150,
    category: 'Entertainment',
    ledgerCategory: 'Rewards',
  }

  const matchingTxByDescription: Transaction = {
    id: 'tx-chatgpt',
    date: '2026-08-29',
    description: 'ChatGPT Plus',
    amount: 95.99,
    category: 'Entertainment',
    ledgerCategory: 'Essentials',
  }

  it('does not mark subscription as paid when an unrelated transaction shares the category', () => {
    render(
      <BillTimeline
        activeRecurringPayments={sampleActiveRecurring}
        transactions={[unrelatedTxInSameCategory]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    // Expand accordion
    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))

    // Open the bill details by clicking the node or badge
    const badgeButton = screen.getAllByText('ChatGPT Plus')[0]
    fireEvent.click(badgeButton)

    // Status should be Pending, NOT Paid
    const statusElement = screen.getAllByText('ChatGPT Plus')[0]
    expect(statusElement).toBeTruthy()
    expect(screen.queryByText('Paid')).toBeNull()
    expect(screen.queryByText('Paid On')).toBeNull()
  })

  it('keeps a server-pending occurrence pending despite a fuzzy description match', () => {
    render(
      <BillTimeline
        activeRecurringPayments={sampleActiveRecurring}
        transactions={[matchingTxByDescription]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    // Expand accordion
    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))

    const badgeButton = screen.getAllByText('ChatGPT Plus')[0]
    fireEvent.click(badgeButton)

    expect(screen.queryByText('Paid')).toBeNull()
    expect(screen.queryByText('Paid On')).toBeNull()
  })

  it('keeps a pending occurrence pending when a linked transaction names a different occurrence', () => {
    render(
      <BillTimeline
        activeRecurringPayments={sampleActiveRecurring}
        transactions={[{ ...matchingTxByDescription, recurringPaymentId: 'rp-chatgpt', recurringOccurrenceDate: '2026-10-27' }]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))
    fireEvent.click(screen.getAllByText('ChatGPT Plus')[0])

    expect(screen.queryByText('Paid')).toBeNull()
    expect(screen.queryByText('Paid On')).toBeNull()
  })

  it('uses the server-paid occurrence status even without a transaction in the client list', () => {
    render(
      <BillTimeline
        activeRecurringPayments={[{ ...sampleActiveRecurring[0], status: 'Paid', isPaid: true, paidDate: '2026-08-03' }]}
        transactions={[]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))
    fireEvent.click(screen.getAllByText('ChatGPT Plus')[0])

    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0)
    expect(screen.getByText('Paid On')).toBeTruthy()
    expect(screen.getByText('2026-08-03')).toBeTruthy()
  })

  it('keeps the legacy undated transaction fallback for cached rows without a status', () => {
    const legacyRow = { ...sampleActiveRecurring[0], status: undefined, isPaid: false } as unknown as ActiveRecurringPayment
    render(
      <BillTimeline
        activeRecurringPayments={[legacyRow]}
        transactions={[matchingTxByDescription]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))
    fireEvent.click(screen.getAllByText('ChatGPT Plus')[0])

    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0)
    expect(screen.getByText('2026-08-29')).toBeTruthy()
  })

  it('links timeline hover and keyboard focus to the matching description', () => {
    render(
      <BillTimeline
        activeRecurringPayments={sampleActiveRecurring}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))
    const node = screen.getByRole('button', { name: 'View subscriptions due on 2026-08-27' })
    const descriptionId = node.getAttribute('aria-describedby')!
    const description = document.getElementById(descriptionId)!

    fireEvent.mouseEnter(node)
    expect(description.dataset.highlighted).toBe('true')
    expect(description.className).toContain('border-accent/60')

    fireEvent.mouseLeave(node)
    fireEvent.focus(node)
    expect(description.dataset.highlighted).toBe('true')
  })

  it('keeps a twenty-date cycle readable with bounded descriptions and a scrollable rail', () => {
    const manyBills = Array.from({ length: 20 }, (_, index): ActiveRecurringPayment => ({
      ...sampleActiveRecurring[0],
      id: `bill-${index}`,
      recurringPaymentId: `rp-${index}`,
      name: `Bill ${index + 1}`,
      dueDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
      dueDay: index + 1,
    }))
    const { container } = render(
      <BillTimeline
        activeRecurringPayments={manyBills}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={1}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))

    expect(screen.getByText(/The 20 dates stay readable/)).toBeTruthy()
    expect(container.querySelector('.overflow-x-auto')).toBeTruthy()
    expect(container.querySelector('.max-h-72.overflow-y-auto')).toBeTruthy()
  })

  it('keeps boundary markers inside paint space and reveals matches in a thirty-date list', () => {
    const manyBills = Array.from({ length: 30 }, (_, index): ActiveRecurringPayment => ({
      ...sampleActiveRecurring[0],
      id: `bill-${index}`,
      recurringPaymentId: `rp-${index}`,
      name: `Bill ${index + 1}`,
      dueDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
      dueDay: index + 1,
    }))
    const { container } = render(
      <BillTimeline
        activeRecurringPayments={manyBills}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={1}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))

    const scrollport = screen.getByTestId('bill-timeline-scrollport')
    expect(scrollport.firstElementChild?.className).toContain('px-5')

    const lastNode = screen.getByRole('button', { name: 'View subscriptions due on 2026-08-30' })
    expect(lastNode.className).toContain('size-7')
    const description = document.getElementById(lastNode.getAttribute('aria-describedby')!)!
    description.scrollIntoView = vi.fn()

    fireEvent.mouseEnter(lastNode)

    expect(description.dataset.highlighted).toBe('true')
    expect(description.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(container.querySelectorAll('[aria-label^="View subscriptions due on"]')).toHaveLength(30)
  })

  it('shows the scheduled recurring amount for a partially paid bill', () => {
    render(
      <BillTimeline
        activeRecurringPayments={[{
          ...sampleActiveRecurring[0],
          amount: 30,
          scheduledAmount: 100,
          paidAmount: 70,
          remainingAmount: 30,
          status: 'PartiallyPaid',
        }]}
        selectedMonth="Aug"
        selectedYear={2026}
        cycleDay={28}
        currency="MYR"
        hideSensitive={false}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Expand Subscriptions Billing Timeline' }))

    expect(screen.getAllByText(/100\.00/).length).toBeGreaterThan(0)
  })
})
