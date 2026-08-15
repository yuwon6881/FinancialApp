import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LedgerAccount } from '../../../types'
import { BucketAccountSetupSheet } from './BucketAccountSetupSheet'

beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const mockAccounts: LedgerAccount[] = [
  {
    id: 'acct-essentials-1',
    name: 'Main Checking',
    bucket: 'Essentials',
    kind: 'Bank',
    isArchived: false,
    interestEnabled: false,
    interestRatePercent: 0,
    interestFrequency: 'Monthly',
    remaining: 100,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
]

describe('BucketAccountSetupSheet', () => {
  it('renders existing bucket accounts with balance inputs', () => {
    render(
      <BucketAccountSetupSheet
        isOpen={true}
        bucket="Essentials"
        accounts={mockAccounts}
        bucketTotal={100}
        currency="MYR"
        hideSensitive={false}
        onClose={vi.fn()}
        onAddAccount={vi.fn()}
        onAddBalanceAdjustment={vi.fn()}
        onReconcileAccounts={vi.fn()}
      />,
    )

    expect(screen.getByText('Set up Essentials accounts')).toBeDefined()
    expect(screen.getByText('Main Checking')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Review setup' })).toBeDefined()
  })

  it('allows adding a new account draft and triggers review modal upon valid input', async () => {
    const onReconcileAccounts = vi.fn().mockResolvedValue(undefined)
    render(
      <BucketAccountSetupSheet
        isOpen={true}
        bucket="Essentials"
        accounts={mockAccounts}
        bucketTotal={100}
        currency="MYR"
        hideSensitive={false}
        onClose={vi.fn()}
        onAddAccount={vi.fn()}
        onAddBalanceAdjustment={vi.fn()}
        onReconcileAccounts={onReconcileAccounts}
      />,
    )

    // Update existing account balance to 60
    const mainInput = screen.getByLabelText(/Current balance for Main Checking/i)
    fireEvent.change(mainInput, { target: { value: '6000' } })

    // Add draft account
    const addAccountBtn = screen.getByRole('button', { name: 'Add account' })
    fireEvent.click(addAccountBtn)

    const nameInput = screen.getByPlaceholderText('e.g. Main bank account')
    fireEvent.change(nameInput, { target: { value: 'Cash jar' } })

    const targetInput = screen.getByLabelText(/Current balance \(MYR\)/i)
    fireEvent.change(targetInput, { target: { value: '4000' } })

    const reviewBtn = screen.getByRole('button', { name: 'Review setup' }) as HTMLButtonElement
    expect(reviewBtn.disabled).toBe(false)
    fireEvent.click(reviewBtn)

    // Confirmation modal should now be open
    expect(screen.getByText(/Confirm (account setup|bucket adjustment)/i)).toBeDefined()

    const confirmBtn = screen.getByRole('button', { name: 'Apply account setup' })
    fireEvent.click(confirmBtn)

    expect(onReconcileAccounts).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'Essentials',
        expectedBucketTotal: 100,
        targets: expect.arrayContaining([
          expect.objectContaining({ id: 'acct-essentials-1', target: 60 }),
          expect.objectContaining({ name: 'Cash jar', target: 40 }),
        ]),
      }),
    )
  })
})
