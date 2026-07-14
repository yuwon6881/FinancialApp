import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RecurringPaymentsView } from './RecurringPaymentsView'

vi.mock('./BillTimeline', () => ({ BillTimeline: () => null }))
vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div role="dialog">{title}{children}</div>
  ),
}))
vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="billing date" type="date" value={value} onChange={event => onChange(event.target.value)} />
  ),
}))

describe('RecurringPaymentsView form', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  it('emits the frequency chosen by the user', () => {
    const onAddPayment = vi.fn()
    render(
      <RecurringPaymentsView
        payments={[]}
        activeRecurringPayments={[]}
        selectedMonth="Jul"
        selectedYear={2026}
        cycleDay={1}
        onAddPayment={onAddPayment}
        onToggleActive={vi.fn()}
        onDeletePayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        categories={[{ id: 'bills', name: 'Bills' }]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'New Subscription' }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Netflix, Spotify'), { target: { value: 'Insurance' } })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '120.00' } })
    fireEvent.change(screen.getAllByLabelText('billing date')[0], { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Monthly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annually' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

    expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Insurance',
      frequency: 'Annually',
      dueDate: 20,
      startDate: '2026-07-20',
    }))
  })
})
