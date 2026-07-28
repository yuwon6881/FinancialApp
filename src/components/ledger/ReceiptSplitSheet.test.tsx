import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReceiptSplitScanResult } from '../../lib/api'
import { ReceiptSplitSheet } from './ReceiptSplitSheet'

vi.mock('../ui/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
    footer,
  }: {
    isOpen: boolean
    title: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
  }) => isOpen ? <section><h1>{title}</h1>{children}{footer}</section> : null,
}))

vi.mock('../ui/DatePicker', () => ({
  DatePicker: ({ value }: { value: string }) => <span>{value}</span>,
}))

vi.mock('../ui/SwipeableRow', () => ({
  SwipeableRow: ({ children, desktopActions }: { children: React.ReactNode; desktopActions: React.ReactNode }) => (
    <div>{children}{desktopActions}</div>
  ),
}))

function result(): ReceiptSplitScanResult {
  return {
    description: 'Shared Dinner',
    date: '2026-07-28',
    currency: 'MYR',
    subtotal: 20,
    total: 23.2,
    category: 'Food',
    ledgerCategory: 'Essentials',
    items: [
      { name: 'Food', quantity: 1, unitPrice: 16, lineTotal: 16, confidence: 1 },
      { name: 'Water', quantity: 1, unitPrice: 4, lineTotal: 4, confidence: 1 },
    ],
    charges: [
      { label: 'Tax', kind: 'tax', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 10, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
      { label: 'Service', kind: 'service', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 6, sequence: 1, eligibleItemIndexes: [], confidence: 1 },
    ],
    fieldConfidence: { description: 1, date: 1, currency: 1, subtotal: 1, total: 1 },
    truncated: false,
    warnings: [],
    confidence: 1,
  }
}

function renderSheet(scanResult = result()) {
  const onUseResult = vi.fn()
  const onClear = vi.fn()
  render(
    <ReceiptSplitSheet
      isOpen
      currency="MYR"
      draft={{ jobId: 'split-1', result: scanResult }}
      failedJob={null}
      activeJobIds={['split-1']}
      onStarted={vi.fn()}
      onClear={onClear}
      onClose={vi.fn()}
      onUseResult={onUseResult}
    />,
  )
  return { onUseResult, onClear }
}

describe('ReceiptSplitSheet', () => {
  it('starts with every scanned item selected and saves only calculated ledger fields', () => {
    const { onUseResult, onClear } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Use This Amount' }))

    expect(onUseResult).toHaveBeenCalledWith({
      description: 'Shared Dinner',
      amount: 23.2,
      date: '2026-07-28',
      category: 'Food',
      ledgerCategory: 'Essentials',
      txType: 'outflow',
    })
    expect(onClear).toHaveBeenCalledWith('split-1')
  })

  it('keeps prices locked until the matching settings-style lock button is used', () => {
    renderSheet()
    const price = screen.getByLabelText('Item 1 price') as HTMLInputElement
    expect(price.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Unlock price for item 1' }))
    expect(price.disabled).toBe(false)
    fireEvent.change(price, { target: { value: '20' } })

    expect(screen.getByRole('button', { name: 'Lock price for item 1' })).toBeTruthy()
    expect(screen.getByText('27.84', { exact: false })).toBeTruthy()
  })

  it('uses integer quantity controls capped by the scanned receipt quantity', () => {
    const scanResult = result()
    scanResult.items[0].quantity = 3
    scanResult.items[0].lineTotal = 48
    renderSheet(scanResult)

    expect(screen.getByLabelText('Quantity for item 1').textContent).toBe('3')
    expect((screen.getByRole('button', { name: 'Increase quantity for item 1' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 1' }))
    expect(screen.getByLabelText('Quantity for item 1').textContent).toBe('2')
  })
})
