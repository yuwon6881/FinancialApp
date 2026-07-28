import { describe, expect, it } from 'vitest'
import type { ReceiptSplitScanResult } from './api'
import { calculateReceiptShare } from './receiptSplitCalculator'

function receipt(overrides: Partial<ReceiptSplitScanResult> = {}): ReceiptSplitScanResult {
  return {
    description: 'Test Restaurant',
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
    ...overrides,
  }
}

describe('calculateReceiptShare', () => {
  it('calculates additive tax and service percentages deterministically', () => {
    const result = calculateReceiptShare(receipt(), [1, 1])

    expect(result.itemSubtotal).toBe(20)
    expect(result.chargeLines.map(line => line.amount)).toEqual([2, 1.2])
    expect(result.total).toBe(23.2)
    expect(result.hasMismatch).toBe(false)
  })

  it('applies a running-total percentage after prior charges', () => {
    const input = receipt({
      total: 23.32,
      charges: [
        { label: 'Service', kind: 'service', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 6, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
        { label: 'Tax', kind: 'tax', operation: 'add', basis: 'runningTotal', amount: null, ratePercent: 10, sequence: 1, eligibleItemIndexes: [], confidence: 1 },
      ],
    })

    expect(calculateReceiptShare(input, [1, 1]).total).toBe(23.32)
  })

  it('prefers a printed charge and allocates it proportionally', () => {
    const input = receipt({
      subtotal: 100,
      total: 116,
      items: [
        { name: 'Mine', quantity: 1, unitPrice: 20, lineTotal: 20, confidence: 1 },
        { name: 'Others', quantity: 1, unitPrice: 80, lineTotal: 80, confidence: 1 },
      ],
      charges: [
        { label: 'Combined charge', kind: 'other', operation: 'add', basis: 'subtotal', amount: 16, ratePercent: 99, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
      ],
    })

    const result = calculateReceiptShare(input, [1, 0])
    expect(result.chargeLines[0].amount).toBe(3.2)
    expect(result.total).toBe(23.2)
  })

  it('supports fractional grouped quantities and currency rounding', () => {
    const input = receipt({
      subtotal: 12,
      total: 12,
      items: [{ name: 'Shared platter', quantity: 3, unitPrice: 4, lineTotal: 12, confidence: 1 }],
      charges: [],
    })

    expect(calculateReceiptShare(input, [0.5]).total).toBe(2)
    expect(calculateReceiptShare(input, [1 / 3]).total).toBe(1.33)
  })

  it('does not add included tax and subtracts discounts', () => {
    const input = receipt({
      subtotal: 20,
      total: 18,
      charges: [
        { label: 'Included tax', kind: 'tax', operation: 'included', basis: 'subtotal', amount: 1.2, ratePercent: 6, sequence: 0, eligibleItemIndexes: [], confidence: 1 },
        { label: 'Discount', kind: 'discount', operation: 'subtract', basis: 'subtotal', amount: 2, ratePercent: null, sequence: 1, eligibleItemIndexes: [], confidence: 1 },
      ],
    })

    const result = calculateReceiptShare(input, [1, 1])
    expect(result.total).toBe(18)
    expect(result.chargeLines[0].amount).toBe(1.2)
  })

  it('applies a charge only to eligible selected items', () => {
    const input = receipt({
      total: 22,
      charges: [
        { label: 'Food tax', kind: 'tax', operation: 'add', basis: 'subtotal', amount: null, ratePercent: 12.5, sequence: 0, eligibleItemIndexes: [0], confidence: 1 },
      ],
    })

    expect(calculateReceiptShare(input, [0, 1]).total).toBe(4)
    expect(calculateReceiptShare(input, [1, 0]).total).toBe(18)
  })

  it('reports selected items whose amounts are missing and receipt mismatches', () => {
    const input = receipt({
      total: 99,
      items: [{ name: 'Unreadable', quantity: 1, unitPrice: null, lineTotal: null, confidence: 0.2 }],
      charges: [],
    })

    const result = calculateReceiptShare(input, [1])
    expect(result.invalidSelectedItemIndexes).toEqual([0])
    expect(result.hasMismatch).toBe(true)
  })
})
