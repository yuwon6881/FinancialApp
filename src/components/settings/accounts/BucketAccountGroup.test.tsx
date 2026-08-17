import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { LedgerAccount } from '../../../types'
import { BucketAccountGroup } from './BucketAccountGroup'

const makeAccount = (partial: Partial<LedgerAccount>): LedgerAccount => ({
  id: 'acc-1',
  name: 'Everyday Checking',
  bucket: 'Essentials',
  kind: 'Bank',
  remaining: 1500,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...partial,
})

describe('BucketAccountGroup', () => {
  it('renders bucket name, balance, account rows, and Add account button', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Maybank Checking', remaining: 2500 })
    const acc2 = makeAccount({ id: 'acc-2', name: 'Cash Wallet', kind: 'Cash', remaining: 300 })

    render(
      <BucketAccountGroup
        bucket="Essentials"
        description="Everyday spending"
        accounts={[acc1, acc2]}
        allBucketAccounts={[acc1, acc2]}
        currency="MYR"
        hideSensitive={false}
        isDeleting={() => false}
        isSyncing={() => false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMoveMoney={vi.fn()}
      />,
    )

    expect(screen.getByText('Essentials')).toBeDefined()
    expect(screen.getByText('Everyday spending')).toBeDefined()
    expect(screen.getByText('Maybank Checking')).toBeDefined()
    expect(screen.getByText('Cash Wallet')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add account' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Update balances' })).toBeDefined()
  })

  it('hides "Update balances" when there are fewer than two open accounts', () => {
    const acc1 = makeAccount({ id: 'acc-1', name: 'Only Checking', remaining: 1000 })

    render(
      <BucketAccountGroup
        bucket="Essentials"
        description="Everyday spending"
        accounts={[acc1]}
        allBucketAccounts={[acc1]}
        currency="MYR"
        hideSensitive={false}
        isDeleting={() => false}
        isSyncing={() => false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMoveMoney={vi.fn()}
      />,
    )

    expect(screen.getByText('Only Checking')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add account' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Update balances' })).toBeNull()
  })

  it('renders empty dashed state when bucket has no accounts', () => {
    render(
      <BucketAccountGroup
        bucket="Rewards"
        description="Plans and treats"
        accounts={[]}
        allBucketAccounts={[]}
        currency="MYR"
        hideSensitive={false}
        isDeleting={() => false}
        isSyncing={() => false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMoveMoney={vi.fn()}
      />,
    )

    expect(screen.getByText('No accounts added for Rewards yet.')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add the first account' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Update balances' })).toBeNull()
  })

  it('offers Record interest on open accounts only, and hands the whole account back', () => {
    // Interest is recorded by hand from the bank's own figure, so the action carries the
    // account whose placement the pre-filled form needs. A closed account cannot receive one.
    const open = makeAccount({ id: 'acc-open', name: 'RYT Savings' })
    const closed = makeAccount({ id: 'acc-closed', name: 'Old Savings', isArchived: true })
    const onRecordInterest = vi.fn()

    render(
      <BucketAccountGroup
        bucket="Essentials"
        description="Everyday spending"
        accounts={[open, closed]}
        allBucketAccounts={[open, closed]}
        currency="MYR"
        hideSensitive={false}
        isDeleting={() => false}
        isSyncing={() => false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMoveMoney={vi.fn()}
        onRecordInterest={onRecordInterest}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Record interest paid into Old Savings' })).toBeNull()
    screen.getByRole('button', { name: 'Record interest paid into RYT Savings' }).click()
    expect(onRecordInterest).toHaveBeenCalledWith(open)
  })

  it('omits Record interest entirely when no handler is supplied', () => {
    render(
      <BucketAccountGroup
        bucket="Essentials"
        description="Everyday spending"
        accounts={[makeAccount({})]}
        allBucketAccounts={[makeAccount({})]}
        currency="MYR"
        hideSensitive={false}
        isDeleting={() => false}
        isSyncing={() => false}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMoveMoney={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /Record interest/ })).toBeNull()
  })
})
