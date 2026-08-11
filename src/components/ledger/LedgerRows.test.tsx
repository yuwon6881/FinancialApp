import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../types'
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
