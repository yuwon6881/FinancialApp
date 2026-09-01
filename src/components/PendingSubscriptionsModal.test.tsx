import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PendingNotification } from '../types'
import { PendingSubscriptionsModal } from './PendingSubscriptionsModal'

vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    children,
    footer,
    backdropClassName,
    panelClassName,
  }: {
    isOpen: boolean
    children: React.ReactNode
    footer?: React.ReactNode
    backdropClassName?: string
    panelClassName?: string
  }) =>
    isOpen
      ? <div data-testid="sheet" data-backdrop-class={backdropClassName} data-panel-class={panelClassName}>{children}{footer}</div>
      : null,
}))

vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value }: { value: string }) => <span>{value}</span>,
}))

describe('PendingSubscriptionsModal', () => {
  const notification: PendingNotification = {
    id: 'household-Jul-2026',
    recurringPaymentId: 'household',
    name: 'Household',
    amount: 870,
    category: 'HouseHold',
    ledgerCategory: 'Stability',
    billingDate: '2026-07-28',
    year: 2026,
    month: 7,
    cycleLabel: 'Jul 28th ~ Aug 27th, 2026',
  }

  const renderModal = (overrides: Partial<React.ComponentProps<typeof PendingSubscriptionsModal>> = {}) => {
    const props: React.ComponentProps<typeof PendingSubscriptionsModal> = {
      isOpen: true,
      pendingNotifications: [notification],
      currency: 'MYR',
      hideSensitive: false,
      onClose: vi.fn(),
      onConfirmSubscription: vi.fn(),
      onDiscardSubscription: vi.fn(),
      onRemoveSubscription: vi.fn(),
      ...overrides,
    }
    render(
      <PendingSubscriptionsModal {...props} />,
    )
    return props
  }

  it('shows confirmation progress and prevents duplicate actions', () => {
    const { onConfirmSubscription } = renderModal()
    const fullPaymentSummary = screen.getByRole('status')
    expect(fullPaymentSummary.textContent).toContain('Full payment selected')
    expect(fullPaymentSummary.textContent).toContain('870.00')
    expect(screen.getByPlaceholderText('Enter part payment')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Paid' }))

    expect(onConfirmSubscription).toHaveBeenCalledWith(notification, '2026-07-28', undefined)
    expect(screen.getByRole('button', { name: /Confirming/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Discard' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true)
  })

  it('uses a wider mobile sheet and a centered full-row confirm action', () => {
    renderModal()

    const sheet = screen.getByTestId('sheet')
    expect(sheet.getAttribute('data-backdrop-class')).toContain('max-sm:p-2')
    expect(sheet.getAttribute('data-panel-class')).toContain('max-sm:p-4')
    const confirm = screen.getByRole('button', { name: 'Confirm Paid' })
    expect(confirm.className).toContain('col-span-2')
    expect(confirm.className).toContain('justify-center')
  })

  it('offers bill review actions without an automatic-open preference', () => {
    renderModal()

    expect(screen.queryByRole('switch', { name: /notify bills/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('shows discard progress and prevents duplicate actions', () => {
    const { onDiscardSubscription } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(onDiscardSubscription).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /Discarding/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Confirm Paid' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true)
  })

  it('delegates removal to confirmation dialog without locking actions prematurely', () => {
    const { onRemoveSubscription } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    expect(onRemoveSubscription).toHaveBeenCalledWith('household')
  })

  it('resets input and action state when a partial payment is confirmed', () => {
    const { onConfirmSubscription } = renderModal()
    const input = screen.getByLabelText('Amount paid')
    fireEvent.change(input, { target: { value: '500' } })
    const partPaymentSummary = screen.getByRole('status')
    expect(partPaymentSummary.textContent).toContain('Part payment')
    expect(partPaymentSummary.textContent).toContain('500.00')
    expect(partPaymentSummary.textContent).toContain('370.00 remains due')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Paid' }))

    expect(onConfirmSubscription).toHaveBeenCalledWith(notification, '2026-07-28', 500)
    expect(screen.getByRole('button', { name: 'Confirm Paid' }).hasAttribute('disabled')).toBe(false)
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('blocks an invalid nonblank amount without blocking discard or remove', () => {
    renderModal()
    const input = screen.getByLabelText('Amount paid')
    fireEvent.change(input, { target: { value: '0' } })

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText(/Enter an amount greater than zero/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm Paid' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Discard' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(false)
  })

  it('keeps the full-payment summary private while sensitive mode is active', () => {
    renderModal({ hideSensitive: true })

    const summary = screen.getByRole('status')
    expect(summary.textContent).toContain('Full payment selected')
    expect(summary.textContent).toContain('Amounts are hidden')
    expect(summary.textContent).not.toContain('870.00')
    expect((screen.getByLabelText('Amount paid') as HTMLInputElement).disabled).toBe(true)
  })
})
