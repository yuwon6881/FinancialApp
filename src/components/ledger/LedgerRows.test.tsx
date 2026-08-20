import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LedgerAccount, Transaction } from '../../types'
import { DesktopLedgerRow } from './LedgerRows'

const transaction = (
  intent: Transaction['stabilityReloadIntent'],
  status?: Transaction['stabilityReloadStatus'],
): Transaction => ({
  id: 'drawdown',
  date: '2026-08-10',
  description: 'Emergency fund spend',
  category: 'Emergency',
  ledgerCategory: 'Stability',
  amount: -250,
  stabilityReloadIntent: intent,
  stabilityReloadStatus: status,
})

const props = (tx: Transaction) => ({
  transaction: tx,
  isDeleting: false,
  isSyncing: false,
  hideSensitive: false,
  currency: 'USD',
  onStartEdit: vi.fn(),
  onDeleteClick: vi.fn(),
  onEditBlocked: vi.fn(),
  onDuplicate: vi.fn(),
  isSelecting: false,
  isSelected: () => false,
  canSelect: () => true,
  onToggleSelected: vi.fn(),
})

describe('LedgerRows emergency-fund intent chip', () => {
  it.each([
    ['Required', 'Put back'],
    ['NotRequired', 'Spent for good'],
    [undefined, 'Put back'],
  ] as const)('shows %s as %s', (intent, label) => {
    render(
      <table><tbody><DesktopLedgerRow {...props(transaction(intent))} /></tbody></table>,
    )

    expect(screen.getByText(label)).toBeTruthy()
  })

  it.each([
    ['Outstanding', 'Put back'],
    ['PartlyRepaid', 'Partly put back'],
    ['Complete', 'Put back complete'],
    ['NotRequired', 'Spent for good'],
  ] as const)('renders the authoritative %s status as %s', (status, label) => {
    render(
      <table><tbody><DesktopLedgerRow {...props(transaction('Required', status))} /></tbody></table>,
    )

    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('LedgerRows duplicate action', () => {
  it('duplicates an ordinary transaction', () => {
    const rowProps = props(transaction('NotRequired'))
    render(<table><tbody><DesktopLedgerRow {...rowProps} /></tbody></table>)

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))

    expect(rowProps.onDuplicate).toHaveBeenCalledWith(rowProps.transaction)
  })

  it.each([
    ['split row', { id: 'tx-split-1' }],
    ['commitment completion', { savingsGoalId: 4 }],
    ['transfer', { ledgerCategory: 'Transfer:Essentials:Rewards' }],
  ])('disables Duplicate for a %s', (_label, changes) => {
    render(<table><tbody><DesktopLedgerRow {...props({ ...transaction('NotRequired'), ...changes })} /></tbody></table>)
    const duplicateBtn = screen.getByRole('button', { name: 'Duplicate' })
    expect(duplicateBtn).toBeDefined()
    expect(duplicateBtn.hasAttribute('disabled')).toBe(true)
  })
})

describe('MobileLedgerRow layout', () => {
  it('renders description with truncation and places account information in the metadata row', async () => {
    const { MobileLedgerRow } = await import('./LedgerRows')
    const tx: Transaction = {
      ...transaction('NotRequired'),
      description: 'Nasi Lemak Ayam Goreng Sambal Extra with Teh Tarik',
      accountId: 'acc-1',
    }
    const accounts: LedgerAccount[] = [{
      id: 'acc-1',
      name: 'Maybank Main',
      bucket: 'Stability',
      remaining: 1000,
      isArchived: false,
      kind: 'Bank',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }]

    render(
      <MobileLedgerRow
        {...props(tx)}
        accounts={accounts}
        hint={false}
      />,
    )

    const descEl = screen.getByText(tx.description)
    expect(descEl.classList.contains('truncate')).toBe(true)
    const accountEl = screen.getByText('Maybank Main')
    expect(accountEl).toBeTruthy()
    expect(accountEl.parentElement?.className).toContain('text-muted-foreground')
    expect(accountEl.parentElement?.className).not.toContain('border')
    const reloadEl = screen.getByText('Spent for good')
    expect(reloadEl).toBeTruthy()
    expect(reloadEl.parentElement?.className).toContain('text-muted-foreground')
    expect(reloadEl.parentElement?.className).not.toContain('rounded-md')
  })
})
