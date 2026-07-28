import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReceiptSplitScanResult } from '../../lib/api'
import { ReceiptSplitSheet } from './ReceiptSplitSheet'

vi.mock('../ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: { isOpen: boolean; title: React.ReactNode; children: React.ReactNode }) =>
    isOpen ? <section><h1>{title}</h1>{children}</section> : null,
}))

function result(total = 23.2): ReceiptSplitScanResult {
  return {
    description: 'Shared Dinner',
    date: '2026-07-28',
    currency: 'MYR',
    subtotal: 20,
    total,
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

function renderSheet(total = 23.2) {
  const onUseResult = vi.fn()
  const onClear = vi.fn()
  render(
    <ReceiptSplitSheet
      isOpen
      currency="MYR"
      draft={{ jobId: 'split-1', result: result(total) }}
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
  it('calculates selected items and prefills a transaction only after confirmation', () => {
    const { onUseResult, onClear } = renderSheet()
    fireEvent.change(screen.getByLabelText('My quantity for item 1'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('My quantity for item 2'), { target: { value: '1' } })

    const useButton = screen.getByRole('button', { name: 'Use This Amount' })
    expect((useButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(useButton)

    expect(onUseResult).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Shared Dinner',
      amount: 23.2,
      txType: 'outflow',
    }))
    expect(onClear).toHaveBeenCalledWith('split-1')
  })

  it('requires explicit acknowledgment when the receipt does not reconcile', () => {
    renderSheet(99)
    fireEvent.change(screen.getByLabelText('My quantity for item 1'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('My quantity for item 2'), { target: { value: '1' } })

    const useButton = screen.getByRole('button', { name: 'Use This Amount' })
    expect((useButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('I reviewed this mismatch and want to continue'))
    expect((useButton as HTMLButtonElement).disabled).toBe(false)
  })
})
