import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerAccount, SavingsGoal } from '../../types'
import { SavingsGoalInterestSheet } from './SavingsGoalInterestSheet'

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

const goal: SavingsGoal = {
  id: 7,
  name: 'Car Maintenance',
  targetAmount: 500,
  earmarkedAmount: 200,
  targetDate: '2026-12-31',
  priority: 'High',
  status: 'active',
  fundingBucket: 'Rewards',
  isRecurring: false,
  recurrenceMonths: 12,
  cycleFundedAmount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const accounts: LedgerAccount[] = [
  {
    id: 'acc-1',
    name: 'Rewards Checking',
    bucket: 'Rewards',
    kind: 'Bank',
    isArchived: false,
    remaining: 1000,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
]

describe('SavingsGoalInterestSheet', () => {
  it('prefills with the current amount and disables confirm initially', () => {
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={accounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i }) as HTMLInputElement
    expect(input.value).toBe('200.00')
    const confirmButton = screen.getByRole('button', { name: 'Record interest' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('shows interest to add on higher amount and enables confirm once an account is chosen', async () => {
    const multiAccounts: LedgerAccount[] = [
      { ...accounts[0], id: 'acc-1', name: 'Rewards Bank' },
      { ...accounts[0], id: 'acc-2', name: 'Rewards Vault' },
    ]
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={multiAccounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '250.00' } })

    expect(screen.getByText('Interest to add: +RM 50.00')).toBeTruthy()
    const confirmButton = screen.getByRole('button', { name: 'Record interest' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)

    fireEvent.click(screen.getByRole('combobox', { name: /interest goes into/i }))
    fireEvent.click(screen.getByRole('option', { name: 'Rewards Bank' }))

    expect(confirmButton.disabled).toBe(false)
  })

  it('shows the release hint when a lower amount is entered', () => {
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={accounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '150.00' } })

    expect(screen.getByText('That is lower than what is set aside. Use Release money to take some out.')).toBeTruthy()
    const confirmButton = screen.getByRole('button', { name: 'Record interest' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('shows the target message when above target', () => {
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={accounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '600.00' } })

    expect(screen.getByText('That is above the target of RM 500.00. Raise the target first.')).toBeTruthy()
    const confirmButton = screen.getByRole('button', { name: 'Record interest' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('shows the add-an-account message when no qualifying account exists', () => {
    const nonQualifyingAccounts: LedgerAccount[] = [
      { ...accounts[0], id: 'acc-credit', kind: 'CreditCard' },
      { ...accounts[0], id: 'acc-essentials', bucket: 'Essentials' },
      { ...accounts[0], id: 'acc-archived', isArchived: true },
    ]
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={nonQualifyingAccounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText('Add an account in the Rewards bucket first.')).toBeTruthy()
    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '250.00' } })

    const confirmButton = screen.getByRole('button', { name: 'Record interest' }) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)
  })

  it('keeps sheet open and shows rejection message, reusing the same operation id on retry', async () => {
    const onConfirm = vi.fn()
      .mockResolvedValueOnce('Only RM 20 of room is left before the target. Raise the target first.')
      .mockResolvedValueOnce(null)

    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={accounts}
        currency="MYR"
        formatSensitive={val => `RM ${val.toFixed(2)}`}
        onClose={() => undefined}
        onConfirm={onConfirm}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '250.00' } })

    const confirmButton = screen.getByRole('button', { name: 'Record interest' })
    await act(async () => {
      fireEvent.click(confirmButton)
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Only RM 20 of room is left before the target. Raise the target first.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Record interest' })).toBeTruthy()

    await act(async () => {
      fireEvent.click(confirmButton)
    })

    expect(onConfirm).toHaveBeenCalledTimes(2)
    const firstOpId = onConfirm.mock.calls[0][2]
    const secondOpId = onConfirm.mock.calls[1][2]
    expect(firstOpId).toBeTruthy()
    expect(firstOpId).not.toMatch(/\s/)
    expect(firstOpId).toBe(secondOpId)
  })

  it('never leaks a digit when formatSensitive masks amounts', () => {
    render(
      <SavingsGoalInterestSheet
        goal={goal}
        accounts={accounts}
        currency="MYR"
        formatSensitive={() => '••••'}
        onClose={() => undefined}
        onConfirm={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox', { name: /amount in this pocket now/i })
    fireEvent.change(input, { target: { value: '250.00' } })
    expect(screen.getByText('Interest to add: +••••')).toBeTruthy()

    fireEvent.change(input, { target: { value: '600.00' } })
    expect(screen.getByText('That is above the target of ••••. Raise the target first.')).toBeTruthy()

    // Ensure the raw unmasked target amount '500' does not leak into the DOM
    expect(screen.queryByText(/500/)).toBeNull()
  })
})
