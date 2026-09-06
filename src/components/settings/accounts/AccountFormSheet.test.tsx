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
  // The server holds account names unique per user and answers a clash with a 409. Account writes
  // are queued, so that verdict lands long after this sheet has closed -- and during the first-run
  // coverage gate there is no toast surface mounted to carry it at all, which is how a duplicate
  // name became a form that appeared to do nothing.
  it('refuses a name another account already uses, without dispatching a save', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        existingAccounts={[mockAccount]}
        currency="MYR"
        onClose={onClose}
        onSave={onSave}
      />,
    )

    // Case and surrounding space must not sneak past a check the server makes case-insensitively.
    fireEvent.change(screen.getByPlaceholderText('Name this account'), { target: { value: '  checking ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))

    expect(screen.getByText('An account with this name already exists. Pick another name.')).toBeDefined()
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('points a clash with a closed account at reopening it', () => {
    const onSave = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        existingAccounts={[mockArchivedAccount]}
        currency="MYR"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText('Name this account'), { target: { value: 'Closed Checking' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))

    // A closed account still owns its name server-side, so "pick another name" would be a dead end
    // when the thing the user actually wants is the Reopen path the gate already offers.
    expect(screen.getByText(/already exists as a closed account/)).toBeDefined()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('lets an account keep its own name while editing', async () => {
    const onSave = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={mockAccount}
        existingAccounts={[mockAccount]}
        currency="MYR"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
  })

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
