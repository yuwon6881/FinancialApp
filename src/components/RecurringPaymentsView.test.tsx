import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { RecurringPaymentsView } from './RecurringPaymentsView'
import { AppPrefsContext } from '../contexts/AppContext'

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

// Placement is explicit: every bucket needs one open account, with no default to fall back on.
const accounts = ['Essentials', 'Growth', 'Stability', 'Rewards'].map(bucket => ({
  id: `acct-${bucket.toLowerCase()}`,
  name: `${bucket} balance`,
  bucket,
  kind: 'Other',
  remaining: 0,
  isArchived: false,
})) as React.ComponentProps<typeof RecurringPaymentsView>['accounts']

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
        accounts={accounts}
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
    fireEvent.click(screen.getByRole('combobox', { name: 'Payment frequency' }))
    fireEvent.click(screen.getByRole('option', { name: 'Annually' }))
    fireEvent.click(screen.getByRole('combobox', { name: /How it's paid/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Manual payment' }))
    // Placement is explicit, so the bill has to name the account that pays it.
    fireEvent.click(screen.getByRole('combobox', { name: /Paid from account/ }))
    fireEvent.click(screen.getByRole('option', { name: /Essentials balance/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Subscription' }))

    expect(onAddPayment).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Insurance',
      frequency: 'Annually',
      dueDate: 20,
      startDate: '2026-07-20',
    }))
  })

  it('opens a FAB-requested form while the server privacy preference is pending', async () => {
    const renderView = (status: 'pending' | 'resolved') => (
      <AppPrefsContext.Provider value={{
        hideSensitive: true,
        sensitivePreferenceStatus: status,
        currency: 'USD',
        darkMode: false,
        formatSensitive: () => '•••',
      }}>
        <RecurringPaymentsView
          payments={[]}
          accounts={accounts}
          activeRecurringPayments={[]}
          selectedMonth="Jul"
          selectedYear={2026}
          cycleDay={1}
          onAddPayment={vi.fn()}
          onToggleActive={vi.fn()}
          onDeletePayment={vi.fn()}
          onUpdatePayment={vi.fn()}
          categories={[{ id: 'bills', name: 'Bills' }]}
          hideSensitive
          autoOpenAddForm
        />
      </AppPrefsContext.Provider>
    )

    const { rerender } = render(renderView('pending'))
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Netflix, Spotify')).toBeTruthy())

    rerender(renderView('resolved'))
    await waitFor(() => expect(screen.queryByPlaceholderText('e.g. Netflix, Spotify')).toBeNull())
  })
})
