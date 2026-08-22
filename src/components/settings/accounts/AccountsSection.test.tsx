import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountsSection } from './AccountsSection'

describe('AccountsSection', () => {
  it('explains that past-cycle navigation does not change today-based account corrections', () => {
    render(
      <AccountsSection
        accounts={[]}
        currency="MYR"
        hideSensitive={false}
        isCurrentCycle={false}
        onAddAccount={vi.fn()}
        onUpdateAccount={vi.fn()}
        onRequestDeleteAccount={vi.fn()}
        onReconcileAccounts={vi.fn()}
      />,
    )

    expect(screen.getByText("Balances shown here are today's")).toBeTruthy()
    expect(screen.getByText(/corrections always use today's balance and post to today's cycle/)).toBeTruthy()
  })

  it('does not repeat the cycle explanation on the current cycle', () => {
    render(
      <AccountsSection
        accounts={[]}
        currency="MYR"
        hideSensitive={false}
        isCurrentCycle
        onAddAccount={vi.fn()}
        onUpdateAccount={vi.fn()}
        onRequestDeleteAccount={vi.fn()}
        onReconcileAccounts={vi.fn()}
      />,
    )

    expect(screen.queryByText("Balances shown here are today's")).toBeNull()
  })

  it('clears a local account filter when search navigates to a hidden account', () => {
    const accounts = [
      { id: 'acc-maybank', name: 'Maybank', bucket: 'Essentials', kind: 'Bank', remaining: 100, isArchived: false },
      { id: 'acc-cash', name: 'Travel cash', bucket: 'Rewards', kind: 'Cash', remaining: 20, isArchived: false },
    ] as React.ComponentProps<typeof AccountsSection>['accounts']
    const props = {
      accounts,
      currency: 'MYR',
      hideSensitive: false,
      isCurrentCycle: true,
      onAddAccount: vi.fn(),
      onUpdateAccount: vi.fn(),
      onRequestDeleteAccount: vi.fn(),
      onReconcileAccounts: vi.fn(),
    }
    const { rerender } = render(<AccountsSection {...props} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter accounts' }), { target: { value: 'Travel' } })
    expect(screen.queryByText('Maybank')).toBeNull()

    rerender(<AccountsSection {...props} highlightedAccountId="acc-maybank" />)
    expect(screen.getByText('Maybank')).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Filter accounts' }).value).toBe('')
  })
})
