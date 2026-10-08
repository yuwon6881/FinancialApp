import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { LedgerAccount, TransactionCategory } from '../../../types'
import { ClearCardBalanceSheet } from './ClearCardBalanceSheet'

const account = (overrides: Partial<LedgerAccount>): LedgerAccount => ({
  id: 'acct',
  name: 'Account',
  bucket: 'Essentials',
  kind: 'Bank',
  isArchived: false,
  remaining: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  ...overrides,
})

const visa = account({ id: 'visa', name: 'Visa', kind: 'CreditCard', remaining: -280 })
const bank = account({ id: 'bank', name: 'Main bank', remaining: 2000 })
const categories: TransactionCategory[] = [
  { id: 'food', name: 'Food', type: 'outflow' },
  { id: 'other', name: 'Other', type: 'both' },
  { id: 'cashback', name: 'Cashback', type: 'inflow' },
]

const renderSheet = (overrides: Partial<React.ComponentProps<typeof ClearCardBalanceSheet>> = {}) => {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <ClearCardBalanceSheet
      card={visa}
      accounts={[bank, visa]}
      categories={categories}
      currency="MYR"
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm, onClose }
}

describe('ClearCardBalanceSheet', () => {
  it('asks again before treating newly arrived card debt as a bank rebate', () => {
    const props = { card: visa, accounts: [bank, visa], categories, currency: 'MYR', onClose: vi.fn(), onConfirm: vi.fn() }
    const { rerender } = render(<ClearCardBalanceSheet {...props} />)
    fireEvent.change(screen.getByLabelText(/Amount paid \(MYR\)/i), { target: { value: '25000' } })
    fireEvent.click(screen.getByRole('radio', { name: /The bank took it off/ }))
    const updatedCard = { ...visa, remaining: -330 }
    rerender(<ClearCardBalanceSheet {...props} card={updatedCard} accounts={[bank, updatedCard]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Choose what happened to the rest.')).toBeTruthy()
  })
  it('does not queue a rebate into a category that was deleted while the sheet was open', () => {
    const props = { card: visa, accounts: [bank, visa], categories, currency: 'MYR', onClose: vi.fn(), onConfirm: vi.fn() }
    const { rerender } = render(<ClearCardBalanceSheet {...props} />)
    fireEvent.change(screen.getByLabelText(/Amount paid \(MYR\)/i), { target: { value: '25000' } })
    fireEvent.click(screen.getByRole('radio', { name: /The bank took it off/ }))
    rerender(<ClearCardBalanceSheet {...props} categories={categories.filter(category => category.name !== 'Cashback')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))
    expect(props.onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Choose a category for the rebate.')).toBeTruthy()
  })
  it('prefills the full amount owed and pays it from the fullest account in one move', () => {
    const { onConfirm, onClose } = renderSheet()

    expect((screen.getByLabelText(/Amount paid \(MYR\)/i) as HTMLInputElement).value).toBe('280.00')
    expect(screen.queryByRole('radiogroup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ ledgerCategory: 'AccountMove', amount: 280, accountId: 'bank', counterAccountId: 'visa' }),
    ])
    expect(onClose).toHaveBeenCalled()
  })

  // Paying 250 against 280 is either a rebate or a part payment, and only the user knows which.
  it('asks what happened to the rest, then records a rebate in a cashback category', () => {
    const { onConfirm } = renderSheet()

    fireEvent.change(screen.getByLabelText(/Amount paid \(MYR\)/i), { target: { value: '25000' } })
    expect(screen.getByText(/What about the other/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Choose what happened to the rest.')).toBeDefined()

    fireEvent.click(screen.getByRole('radio', { name: /The bank took it off/ }))
    expect(screen.getByText('The card will be fully paid off.', { exact: false })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ ledgerCategory: 'AccountMove', amount: 250 }),
      expect.objectContaining({ ledgerCategory: 'Essentials', category: 'Cashback', amount: 30, accountId: 'visa' }),
    ])
  })

  it('records a part payment without a rebate when the rest is still owed', () => {
    const { onConfirm } = renderSheet()

    fireEvent.change(screen.getByLabelText(/Amount paid \(MYR\)/i), { target: { value: '10000' } })
    fireEvent.click(screen.getByRole('radio', { name: /I still owe it/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }))

    expect(onConfirm).toHaveBeenCalledWith([expect.objectContaining({ amount: 100 })])
  })

  it('refuses more than the card owes', () => {
    const { onConfirm } = renderSheet()

    fireEvent.change(screen.getByLabelText(/Amount paid \(MYR\)/i), { target: { value: '30000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear balance' }))

    expect(screen.getByText('That is more than this card owes.')).toBeDefined()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('explains where to pay from when the spending buckets have no cash account', () => {
    renderSheet({ accounts: [visa, account({ id: 'reserve', bucket: 'Stability', remaining: 5000 })] })

    expect(screen.getByRole('alert').textContent).toMatch(/Add an account to Essentials or Rewards/)
    expect((screen.getByRole('button', { name: 'Clear balance' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
