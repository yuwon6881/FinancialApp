import type {
  ReceiptSplitCharge,
  ReceiptSplitItem,
  ReceiptSplitScanResult,
} from './api'

const SCALE = 1_000_000n
const MINOR_UNIT = 10_000n

function scaled(value: number | null | undefined): bigint {
  if (value == null || !Number.isFinite(value)) return 0n
  const sign = value < 0 ? -1n : 1n
  const text = Math.abs(value).toFixed(6)
  const [whole, fraction = ''] = text.split('.')
  return sign * (BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, '0').slice(0, 6)))
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n
  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  return sign * ((n + d / 2n) / d)
}

function multiply(left: bigint, right: bigint): bigint {
  return roundedDivide(left * right, SCALE)
}

function lineTotal(item: ReceiptSplitItem): bigint | null {
  if (item.lineTotal != null && Number.isFinite(item.lineTotal) && item.lineTotal >= 0)
    return scaled(item.lineTotal)
  if (item.unitPrice != null && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && item.quantity > 0)
    return multiply(scaled(item.unitPrice), scaled(item.quantity))
  return null
}

function toMoney(value: bigint): number {
  const minor = roundedDivide(value, MINOR_UNIT)
  return Number(minor) / 100
}

function selectedBaseForCharge(
  charge: ReceiptSplitCharge,
  itemShares: bigint[],
  fullLines: Array<bigint | null>,
  /** Lines with no readable amount that the user did not take, per index. */
  unpricedOtherLines: boolean[],
): { selected: bigint; full: bigint; missingFromBase: boolean } {
  // Note: an empty eligibleItemIndexes array is the scan's encoding for "applies to all items".
  // Sentinel collision with an item-exclusive charge whose target items were deleted is prevented
  // by dropping the charge in removeItem.
  const eligible = charge.eligibleItemIndexes.length > 0
    ? new Set(charge.eligibleItemIndexes)
    : null
  let selected = 0n
  let full = 0n
  let missingFromBase = false
  fullLines.forEach((value, index) => {
    if (eligible && !eligible.has(index)) return
    selected += itemShares[index] ?? 0n
    full += value ?? 0n
    if (unpricedOtherLines[index]) missingFromBase = true
  })
  return { selected, full, missingFromBase }
}

export interface ReceiptShareChargeLine {
  label: string
  operation: ReceiptSplitCharge['operation']
  amount: number
  ratePercent: number | null
}

export interface ReceiptShareCalculation {
  itemSubtotal: number
  chargeLines: ReceiptShareChargeLine[]
  total: number
  selectedItemCount: number
  invalidSelectedItemIndexes: number[]
  /**
   * A printed charge is being spread over a line nobody took that has no readable price, so
   * your share of that charge is higher than the receipt supports.
   */
  chargeBaseIncomplete: boolean
  receiptComputedTotal: number
  reconciliationDifference: number | null
  hasMismatch: boolean
}

export function calculateReceiptShare(
  receipt: ReceiptSplitScanResult,
  selectedQuantities: number[],
): ReceiptShareCalculation {
  const fullLines = receipt.items.map(lineTotal)
  const invalidSelectedItemIndexes: number[] = []
  const itemShares = receipt.items.map((item, index) => {
    const selected = selectedQuantities[index] ?? 0
    if (!(selected > 0)) return 0n
    const total = fullLines[index]
    if (total == null || !(item.quantity > 0)) {
      invalidSelectedItemIndexes.push(index)
      return 0n
    }
    const bounded = Math.min(selected, item.quantity)
    return roundedDivide(total * scaled(bounded), scaled(item.quantity))
  })

  // A printed charge is prorated by your share of the lines it covers. An unreadable price on a
  // line you did not take still shrinks that denominator, silently growing your cut of the
  // charge — and unlike a selected line with no price, nothing else on the sheet mentions it.
  const unpricedOtherLines = fullLines.map((value, index) =>
    value == null && !((selectedQuantities[index] ?? 0) > 0))

  const calculateCharges = (shares: bigint[], useFullReceipt: boolean) => {
    let runningImpact = 0n
    let prorationBaseIncomplete = false
    const lines: Array<{ charge: ReceiptSplitCharge; allocation: bigint }> = []
    const ordered = [...receipt.charges].sort((a, b) => a.sequence - b.sequence)
    for (const charge of ordered) {
      const bases = selectedBaseForCharge(charge, shares, fullLines, unpricedOtherLines)
      const selectedBase = bases.selected + (charge.basis === 'runningTotal' ? runningImpact : 0n)
      const fullBase = bases.full
      let allocation = 0n
      const hasPrintedAmount = charge.amount != null && Number.isFinite(charge.amount)
      const hasRatePercent = charge.ratePercent != null && Number.isFinite(charge.ratePercent)

      if (hasPrintedAmount && (useFullReceipt || !bases.missingFromBase || !hasRatePercent)) {
        // Printed amounts use bases.selected and fullBase; basis: 'runningTotal' is intentionally ignored for printed amounts.
        const printed = scaled(Math.abs(charge.amount!))
        allocation = useFullReceipt
          ? printed
          : fullBase === 0n ? 0n : roundedDivide(printed * bases.selected, fullBase)
        if (!useFullReceipt && bases.missingFromBase && bases.selected > 0n) prorationBaseIncomplete = true
      } else if (hasRatePercent) {
        const clampedBase = selectedBase < 0n ? 0n : selectedBase
        allocation = roundedDivide(clampedBase * scaled(Math.abs(charge.ratePercent!)), SCALE * 100n)
      }
      if (charge.operation === 'add') runningImpact += allocation
      if (charge.operation === 'subtract') runningImpact -= allocation
      lines.push({ charge, allocation })
    }
    return { impact: runningImpact, lines, prorationBaseIncomplete }
  }

  const selectedSubtotal = itemShares.reduce((sum, value) => sum + value, 0n)
  const selectedCharges = calculateCharges(itemShares, false)
  const fullShares = fullLines.map(value => value ?? 0n)
  const fullSubtotal = receipt.subtotal == null
    ? fullShares.reduce((sum, value) => sum + value, 0n)
    : scaled(receipt.subtotal)
  const fullCharges = calculateCharges(fullShares, true)
  const receiptComputed = fullSubtotal + fullCharges.impact
  const difference = receipt.total == null ? null : toMoney(receiptComputed - scaled(receipt.total))

  return {
    itemSubtotal: toMoney(selectedSubtotal),
    chargeLines: selectedCharges.lines.map(({ charge, allocation }) => ({
      label: charge.label,
      operation: charge.operation,
      amount: toMoney(allocation),
      ratePercent: charge.ratePercent,
    })),
    total: toMoney(selectedSubtotal + selectedCharges.impact),
    selectedItemCount: selectedQuantities.filter(value => value > 0).length,
    invalidSelectedItemIndexes,
    chargeBaseIncomplete: selectedCharges.prorationBaseIncomplete,
    receiptComputedTotal: toMoney(receiptComputed),
    reconciliationDifference: difference,
    hasMismatch: difference != null && Math.abs(difference) > 0.01,
  }
}
