import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReceiptSplitScanResult } from '../../lib/api'
import { ReceiptSplitSheet } from './ReceiptSplitSheet'

vi.mock('../ui/BottomSheet', () => ({
  // The real sheet routes a swipe-down, the back button, Escape and any tab navigation to onClose,
  // so the mock exposes it as a plain dismiss control.
  BottomSheet: ({
    isOpen,
    title,
    children,
    footer,
    onClose,
  }: {
    isOpen: boolean
    title: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    onClose: () => void
  }) => isOpen ? (
    <section>
      <h1>{title}</h1>
      <button type="button" onClick={onClose}>dismiss sheet</button>
      {children}
      {footer}
    </section>
  ) : null,
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

function renderSheet(scanResult = result(), currency = 'MYR') {
  const onUseResult = vi.fn()
  const onClear = vi.fn()
  const onClose = vi.fn()
  render(
    <ReceiptSplitSheet
      isOpen
      currency={currency}
      draft={{ jobId: 'split-1', result: scanResult }}
      onClear={onClear}
      onClose={onClose}
      onUseResult={onUseResult}
    />,
  )
  return { onUseResult, onClear, onClose }
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

  it('renders scanned item names as titles instead of editable fields', () => {
    renderSheet()

    expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Item 1 name' })).toBeNull()
  })

  it('keeps prices locked until the matching settings-style lock button is used', () => {
    renderSheet()
    fireEvent.click(screen.getAllByText('Price and charge breakdown')[0])
    const price = screen.getByLabelText('Item 1 price') as HTMLInputElement
    expect(price.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Unlock price for item 1' }))
    expect(price.disabled).toBe(false)
    fireEvent.change(price, { target: { value: '20' } })

    expect(screen.getByRole('button', { name: 'Lock price for item 1' })).toBeTruthy()
    expect(screen.getAllByText('27.84', { exact: false }).length).toBeGreaterThan(0)
  })

  it('shows the result first and keeps secondary AI details collapsed initially', () => {
    renderSheet()

    expect(screen.getByText('Your share')).toBeTruthy()
    expect(screen.getAllByText('23.20', { exact: false }).length).toBeGreaterThan(0)
    expect((screen.getByText('Receipt details').closest('details') as HTMLDetailsElement).open).toBe(false)
    expect((screen.getAllByText('Price and charge breakdown')[0].closest('details') as HTMLDetailsElement).open).toBe(false)
    expect((screen.getByText('How your total was calculated').closest('details') as HTMLDetailsElement).open).toBe(false)
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

  // 0 has to be reachable, and it has to mean something different from deleting the line: the line
  // stays on the receipt, so the printed charges keep being spread over the whole bill.
  it('lets an item go down to nobody-of-mine without dropping it from the receipt', () => {
    const { onUseResult } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 1' }))
    expect(screen.getByLabelText('Quantity for item 1').textContent).toBe('0')
    expect((screen.getByRole('button', { name: 'Decrease quantity for item 1' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Not yours')).toBeTruthy()

    // Water alone: 4.00 plus its own 10% tax and 6% service, not the whole bill's charges.
    fireEvent.click(screen.getByRole('button', { name: 'Use This Amount' }))
    expect(onUseResult).toHaveBeenCalledWith(expect.objectContaining({ amount: 4.64 }))
  })

  it('says so when the scanned lines do not add up to the printed total', () => {
    renderSheet({ ...result(), total: 30 })

    expect(screen.getByText(/but the receipt says/)).toBeTruthy()
  })

  it('warns that an unreadable price on any line inflates your cut of a printed charge', () => {
    renderSheet({
      ...result(),
      total: 25,
      items: [
        { name: 'Mine', quantity: 1, unitPrice: 16, lineTotal: 16, confidence: 1 },
        { name: 'Unreadable', quantity: 1, unitPrice: null, lineTotal: null, confidence: 0.2 },
      ],
      charges: [
        { label: 'Service', kind: 'service', operation: 'add', basis: 'subtotal', amount: 5, ratePercent: null, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
      ],
    })

    // Item 2 starts selected but has no price, so the sheet asks for it as an invalid line;
    // deselecting it leaves the charge silently landing entirely on item 1.
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 2' }))

    expect(screen.getByText(/overstates your\s+share of it/)).toBeTruthy()
  })

  it('cannot save a receipt where nothing is yours', () => {
    renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 2' }))

    expect((screen.getByRole('button', { name: 'Use This Amount' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('calculates the per-row share using the chosen quantity', () => {
    const scanResult = result()
    scanResult.items = [
      { name: 'Food', quantity: 3, unitPrice: 10, lineTotal: 30, confidence: 1 },
    ]
    scanResult.charges = [
      { label: 'Tax', kind: 'tax', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 10, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
    ]
    renderSheet(scanResult)

    // Initial: 3 of 3 -> share is 30 + 3 = 33.00
    expect(screen.getAllByText('RM 33.00').length).toBeGreaterThanOrEqual(1)

    // Decrease to 2 of 3 -> share should be 20 + 2 = 22.00
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity for item 1' }))
    expect(screen.getByLabelText('Quantity for item 1').textContent).toBe('2')
    expect(screen.getAllByText('RM 22.00').length).toBeGreaterThanOrEqual(1)
  })

  it('drops item-exclusive charges and remaps indexes when an item is deleted', () => {
    const scanResult = result()
    scanResult.items = [
      { name: 'Food', quantity: 1, unitPrice: 16, lineTotal: 16, confidence: 1 },
      { name: 'Water', quantity: 1, unitPrice: 4, lineTotal: 4, confidence: 1 },
      { name: 'Coffee', quantity: 1, unitPrice: 5, lineTotal: 5, confidence: 1 },
    ]
    scanResult.charges = [
      { label: 'Water Tax', kind: 'tax', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 10, sequence: 0, eligibleItemIndexes: [1], confidence: 1 },
      { label: 'Coffee Fee', kind: 'other', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 20, sequence: 1, eligibleItemIndexes: [2], confidence: 1 },
    ]
    const { onUseResult } = renderSheet(scanResult)

    // Delete Water (index 1)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Water' }))

    expect(screen.queryByRole('heading', { name: 'Water' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Food' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Coffee' })).toBeTruthy()

    // Food (16) + Coffee (5) + Coffee Fee (20% of 5 = 1) = 22.00.
    // Water Tax was exclusive to Water, so it was dropped and NOT applied globally.
    fireEvent.click(screen.getByRole('button', { name: 'Use This Amount' }))
    expect(onUseResult).toHaveBeenCalledWith(expect.objectContaining({ amount: 22 }))
  })

  // A downward flick anywhere on the sheet, the Android back button and any tab navigation all
  // reach onClose. Deleting the scan there threw away the whole itemised receipt on a mis-swipe.
  it('keeps the scan when the sheet is dismissed rather than discarded', () => {
    const { onClear, onClose } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'dismiss sheet' }))

    expect(onClose).toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
  })

  it('clears the scan only when it is explicitly discarded', () => {
    const { onClear, onClose } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(onClear).toHaveBeenCalledWith('split-1')
    expect(onClose).toHaveBeenCalled()
  })

  // Nothing here converts, so a foreign receipt read as local money would overstate or understate
  // every figure on the sheet without ever saying so.
  it('says when the receipt is printed in another currency', () => {
    renderSheet({ ...result(), currency: 'THB' }, 'MYR')

    expect(screen.getByText(/printed in THB/)).toBeTruthy()
  })

  it('stays quiet when the receipt currency matches the account', () => {
    renderSheet({ ...result(), currency: 'myr' }, 'MYR')

    expect(screen.queryByText(/printed in/)).toBeNull()
  })
})
