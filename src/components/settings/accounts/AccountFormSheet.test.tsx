import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { LedgerAccount } from '../../../types'
import { AccountFormSheet } from './AccountFormSheet'
const mockAccount: LedgerAccount = {
  id: 'acct-1',
  name: 'Checking',
  bucket: 'Essentials',
  kind: 'Bank',
  isArchived: false,
  remaining: 150,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const mockArchivedAccount: LedgerAccount = {
  ...mockAccount,
  id: 'acct-2',
  name: 'Closed Checking',
  isArchived: true,
}

describe('AccountFormSheet', () => {
  it('validates required name field before submitting', () => {
    const onSave = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        currency="MYR"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    const saveBtn = screen.getByRole('button', { name: 'Add account' })
    fireEvent.click(saveBtn)

    expect(screen.getByText('Enter an account name.')).toBeDefined()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('submits a valid new account', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        defaultBucket="Stability"
        currency="MYR"
        onClose={onClose}
        onSave={onSave}
      />,
    )

    const nameInput = screen.getByPlaceholderText('Name this account')
    fireEvent.change(nameInput, { target: { value: 'High Yield Savings' } })

    const saveBtn = screen.getByRole('button', { name: 'Add account' })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith({
      name: 'High Yield Savings',
      bucket: 'Stability',
      kind: 'Bank',
      openingAmount: 0,
      targetBalance: undefined,
      isArchived: false,
    })
  })

  it('populates fields when editing an existing account and allows archiving with unchanged balance', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={mockAccount}
        currency="MYR"
        onClose={onClose}
        onSave={onSave}
      />,
    )

    expect(screen.getByDisplayValue('Checking')).toBeDefined()
    expect(screen.getByText('Balance unchanged')).toBeDefined()

    const archiveCheckbox = screen.getByLabelText(/Mark account as closed/i)
    fireEvent.click(archiveCheckbox)

    const saveBtn = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith({
      name: 'Checking',
      bucket: 'Essentials',
      kind: 'Bank',
      openingAmount: undefined,
      targetBalance: undefined,
      isArchived: true,
    })
  })

  it('locks bucket select and closed checkbox when balance is changed in edit mode', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={mockAccount}
        bucketAccounts={[mockAccount]}
        bucketTotal={150}
        currency="MYR"
        onClose={onClose}
        onSave={onSave}
      />,
    )

    const balanceInput = screen.getByLabelText(/Balance today \(MYR\)/i)
    fireEvent.change(balanceInput, { target: { value: '25000' } }) // 250.00

    expect(screen.getByText(/Was .*150\.00 · Essentials total becomes .*250\.00/i)).toBeDefined()
    expect(screen.getByText('Move this account to another bucket on its own, then correct the balance.')).toBeDefined()
    expect(screen.getByText('Closed accounts cannot change balance. Save the balance correction first.')).toBeDefined()

    const saveBtn = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      targetBalance: 250,
    }))
  })

  it('disables balance input and shows reopen hint for an archived account', () => {
    render(
      <AccountFormSheet
        isOpen={true}
        account={mockArchivedAccount}
        currency="MYR"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    const balanceInput = screen.getByLabelText(/Balance today \(MYR\)/i) as HTMLInputElement
    expect(balanceInput.disabled).toBe(true)
    expect(screen.getByText('Reopen this account to correct its balance.')).toBeDefined()
  })

  it('renders Growth separation note only when bucket is Growth', () => {
    const { rerender } = render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        defaultBucket="Essentials"
        currency="MYR"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Growth is kept separate/i)).toBeNull()

    rerender(
      <AccountFormSheet
        isOpen={true}
        account={null}
        defaultBucket="Growth"
        currency="MYR"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText(/Growth is kept separate/i)).toBeDefined()
  })
})
