import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LedgerAccount } from '../../../types'
import { AccountFormSheet } from './AccountFormSheet'

const mockAccount: LedgerAccount = {
  id: 'acct-1',
  name: 'Checking',
  bucket: 'Essentials',
  kind: 'Bank',
  isArchived: false,
  interestEnabled: false,
  interestRatePercent: 0,
  interestFrequency: 'Monthly',
  remaining: 150,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
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

  it('submits valid new account with interest settings enabled', () => {
    const onSave = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={null}
        defaultBucket="Stability"
        currency="MYR"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    const nameInput = screen.getByPlaceholderText('Name this account')
    fireEvent.change(nameInput, { target: { value: 'High Yield Savings' } })

    const interestCheckbox = screen.getByLabelText(/Earn interest on this account/i)
    fireEvent.click(interestCheckbox)

    const rateInput = screen.getByPlaceholderText('5')
    fireEvent.change(rateInput, { target: { value: '4.25' } })

    const saveBtn = screen.getByRole('button', { name: 'Add account' })
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith({
      name: 'High Yield Savings',
      bucket: 'Stability',
      kind: 'Bank',
      openingAmount: 0,
      interestEnabled: true,
      interestRatePercent: 4.25,
      interestFrequency: 'Monthly',
      isArchived: false,
    })
  })

  it('populates fields when editing an existing account and allows archiving', () => {
    const onSave = vi.fn()
    render(
      <AccountFormSheet
        isOpen={true}
        account={mockAccount}
        currency="MYR"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    )

    expect(screen.getByDisplayValue('Checking')).toBeDefined()

    const archiveCheckbox = screen.getByLabelText(/Mark account as closed/i)
    fireEvent.click(archiveCheckbox)

    const saveBtn = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(saveBtn)

    expect(onSave).toHaveBeenCalledWith({
      name: 'Checking',
      bucket: 'Essentials',
      kind: 'Bank',
      openingAmount: undefined,
      interestEnabled: false,
      interestRatePercent: 0,
      interestFrequency: 'Monthly',
      isArchived: true,
    })
  })
})
