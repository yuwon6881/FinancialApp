import { fireEvent, render, screen } from '@testing-library/react'
import { PendingSubscriptionsModal } from './PendingSubscriptionsModal'

vi.mock('./ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}))

vi.mock('./ui/DatePicker', () => ({
  DatePicker: ({ value }: { value: string }) => <span>{value}</span>,
}))

describe('PendingSubscriptionsModal', () => {
  it('shows confirmation progress and prevents duplicate actions', () => {
    const onConfirmSubscription = vi.fn()
    render(
      <PendingSubscriptionsModal
        isOpen
        pendingNotifications={[{
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
        }]}
        currency="MYR"
        hideSensitive={false}
        showOnLoginChecked
        onToggleShowOnLogin={vi.fn()}
        onClose={vi.fn()}
        onConfirmSubscription={onConfirmSubscription}
        onDiscardSubscription={vi.fn()}
        onRemoveSubscription={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Paid' }))

    expect(onConfirmSubscription).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /Confirming/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Discard' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove' }).hasAttribute('disabled')).toBe(true)
  })
})
