import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AccountsSection } from './AccountsSection'

describe('AccountsSection', () => {
  it.each(['Edit Visa', 'Update balances'])('removes %s money fields when sensitive mode turns on', action => {
    const props = {
      accounts: [
        { id: 'visa', name: 'Visa', bucket: 'Essentials', kind: 'CreditCard', remaining: -280, creditLimit: 4000, isArchived: false },
        { id: 'bank', name: 'Bank', bucket: 'Essentials', kind: 'Bank', remaining: 2000, isArchived: false },
      ] as React.ComponentProps<typeof AccountsSection>['accounts'],
      currency: 'MYR', hideSensitive: false,
      onAddAccount: vi.fn(), onUpdateAccount: vi.fn(), onRequestDeleteAccount: vi.fn(), onReconcileAccounts: vi.fn(),
    }
    const { rerender } = render(<AccountsSection {...props} />)
    fireEvent.click(screen.getByRole('button', { name: action }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<AccountsSection {...props} hideSensitive />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<AccountsSection {...props} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('removes an open payment sheet when sensitive mode turns on', () => {
    const props = {
      accounts: [
        { id: 'visa', name: 'Visa', bucket: 'Essentials', kind: 'CreditCard', remaining: -280, isArchived: false },
        { id: 'bank', name: 'Bank', bucket: 'Essentials', kind: 'Bank', remaining: 2000, isArchived: false },
      ] as React.ComponentProps<typeof AccountsSection>['accounts'],
      currency: 'MYR', hideSensitive: false,
      onAddAccount: vi.fn(), onUpdateAccount: vi.fn(), onRequestDeleteAccount: vi.fn(),
      onReconcileAccounts: vi.fn(), onSettleCard: vi.fn(),
    }
    const { rerender } = render(<AccountsSection {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Visa balance' }))
    expect(screen.getByRole('dialog', { name: 'Clear card balance' })).toBeTruthy()
    rerender(<AccountsSection {...props} hideSensitive />)
    expect(screen.queryByRole('dialog', { name: 'Clear card balance' })).toBeNull()
    expect(props.onSettleCard).not.toHaveBeenCalled()
    rerender(<AccountsSection {...props} />)
    expect(screen.queryByRole('dialog', { name: 'Clear card balance' })).toBeNull()
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
