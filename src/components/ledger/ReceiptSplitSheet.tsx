import { Input } from '../ui/Input'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import type { ReceiptSplitItem, ReceiptSplitScanResult } from '../../lib/api'
import type { ReceiptSplitDraft } from '../../lib/useReceiptSplitPolling'
import { calculateReceiptShare } from '../../lib/receiptSplitCalculator'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { DatePicker } from '../ui/DatePicker'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { ModalActions } from '../ui/ModalActions'
import { ReceiptSplitItemRow } from './ReceiptSplitItemRow'
import type { TransactionPrefillDraft } from './TransactionFormSheet'

interface Props {
  isOpen: boolean
  currency: string
  /** The scan is started from the transaction form's picker; this sheet is purely the editor. */
  draft: ReceiptSplitDraft | null
  onClear: (scanId: string) => void | Promise<void>
  onClose: () => void
  onUseResult: (draft: TransactionPrefillDraft) => void
}

/** A receipt printed in one currency and priced in another is not a conversion we can make. */
function foreignCurrency(receipt: ReceiptSplitScanResult | null, accountCurrency: string): string | null {
  const printed = receipt?.currency?.trim().toUpperCase()
  if (!printed) return null
  return printed === accountCurrency.trim().toUpperCase() ? null : printed
}

function receiptQuantity(item: ReceiptSplitItem): number {
  return Math.max(1, Math.floor(item.quantity))
}

function editableUnitPrice(item: ReceiptSplitItem): number | null {
  if (item.unitPrice != null && Number.isFinite(item.unitPrice)) return item.unitPrice
  const quantity = receiptQuantity(item)
  if (item.lineTotal != null && Number.isFinite(item.lineTotal)) return item.lineTotal / quantity
  return null
}


function parsedPrice(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null
}

export function ReceiptSplitSheet({
  isOpen,
  currency,
  draft,
  onClear,
  onClose,
  onUseResult,
}: Props) {
  const [receipt, setReceipt] = useState<ReceiptSplitScanResult | null>(null)
  const [selectedQuantities, setSelectedQuantities] = useState<number[]>([])
  const [unlockedPriceIndexes, setUnlockedPriceIndexes] = useState<Set<number>>(new Set())
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const appliedJobRef = useRef<string | null>(null)

  useEffect(() => {
    if (!draft || appliedJobRef.current === draft.jobId) return
    appliedJobRef.current = draft.jobId
    setActiveJobId(draft.jobId)
    setReceipt({
      ...draft.result,
      items: draft.result.items.map(item => ({ ...item, quantity: receiptQuantity(item) })),
    })
    setSelectedQuantities(draft.result.items.map(receiptQuantity))
    setUnlockedPriceIndexes(new Set())
  }, [draft])

  const calculation = useMemo(
    () => receipt ? calculateReceiptShare(receipt, selectedQuantities) : null,
    [receipt, selectedQuantities],
  )

  const printedCurrency = foreignCurrency(receipt, currency)

  const itemCalculations = useMemo(() => {
    if (!receipt) return []
    return receipt.items.map((_, itemIndex) => {
      const selected = selectedQuantities[itemIndex] ?? 0
      const qty = selected > 0 ? selected : 1
      const quantities = receipt.items.map((__, index) => index === itemIndex ? qty : 0)
      return calculateReceiptShare(receipt, quantities)
    })
  }, [receipt, selectedQuantities])

  const canUse = Boolean(
    receipt
    && calculation
    && calculation.selectedItemCount > 0
    && calculation.invalidSelectedItemIndexes.length === 0
    && calculation.total >= 0,
  )

  /**
   * Dismissing is not discarding. This sheet closes on a downward flick from anywhere on it, on
   * the browser/Android back button, and on any tab navigation — deleting the scan on those would
   * throw away a whole itemised receipt, and the photo and AI call behind it, on a mis-swipe. A
   * dismissed scan stays on the Ledger's "Scan ready for review" banner; only the explicit
   * Discard below, and consuming the result, clear it.
   */
  const discardAndClose = () => {
    if (activeJobId) void onClear(activeJobId)
    onClose()
  }

  const useResult = () => {
    if (!receipt || !calculation || !canUse) return
    onUseResult({
      description: receipt.description || 'Shared receipt',
      amount: calculation.total,
      date: receipt.date,
      category: receipt.category,
      ledgerCategory: receipt.ledgerCategory,
      txType: 'outflow',
    })
    discardAndClose()
  }

  const updatePrice = (index: number, value: string) => {
    setReceipt(current => {
      if (!current) return current
      const price = parsedPrice(value)
      return {
        ...current,
        items: current.items.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          unitPrice: price,
          lineTotal: price == null ? null : price * receiptQuantity(item),
        } : item),
      }
    })
  }

  const removeItem = (index: number) => {
    setReceipt(current => {
      if (!current) return current
      const nextCharges = current.charges
        .filter(charge => {
          if (charge.eligibleItemIndexes.length > 0) {
            const remaining = charge.eligibleItemIndexes.filter(itemIndex => itemIndex !== index)
            if (remaining.length === 0) return false
          }
          return true
        })
        .map(charge => ({
          ...charge,
          eligibleItemIndexes: charge.eligibleItemIndexes
            .filter(itemIndex => itemIndex !== index)
            .map(itemIndex => itemIndex > index ? itemIndex - 1 : itemIndex),
        }))

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
        charges: nextCharges,
      }
    })
    setSelectedQuantities(current => current.filter((_, itemIndex) => itemIndex !== index))
    setUnlockedPriceIndexes(current => new Set(
      [...current]
        .filter(itemIndex => itemIndex !== index)
        .map(itemIndex => itemIndex > index ? itemIndex - 1 : itemIndex),
    ))
  }

  const changeQuantity = (index: number, delta: number) => {
    if (!receipt) return
    const maximum = receiptQuantity(receipt.items[index])
    // Down to 0, not 1: "none of this one is mine" is the common case on a shared bill, and the
    // only way to say it used to be deleting the line — which also drops it from the base a
    // printed charge is spread over, silently growing your share of that charge.
    setSelectedQuantities(current => current.map((quantity, itemIndex) =>
      itemIndex === index ? Math.max(0, Math.min(maximum, quantity + delta)) : quantity))
  }

  const togglePriceLock = (index: number) => {
    setUnlockedPriceIndexes(current => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Split Receipt"
      maxWidthClassName="max-w-3xl"
      footer={receipt ? (
        <ModalActions>
          <Button variant="secondary" type="button" onClick={discardAndClose} className="rounded-xl py-2.5">
            Discard
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={!canUse}
            onClick={useResult}
            className="rounded-xl py-2.5 shadow-md"
          >
            Use This Amount
          </Button>
        </ModalActions>
      ) : undefined}
    >
      {receipt && calculation && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <p className="text-eyebrow uppercase text-accent-ink">Your share</p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <strong className="text-2xl font-black tracking-tight text-foreground">
                {formatCurrencyVal(calculation.total, currency)}
              </strong>
              <span className="pb-0.5 text-right text-xs text-muted-foreground">
                {calculation.selectedItemCount} selected item{calculation.selectedItemCount === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          <details className="group rounded-2xl border border-border/60 bg-muted/15">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-xs font-bold text-foreground">
              Receipt details
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-3 border-t border-border/50 p-3.5 sm:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]">
              <FormField
                label="Description"
                labelClassName={receipt.fieldConfidence.description < 0.65 ? 'text-amber-600 dark:text-amber-400' : undefined}
              >
                <Input
                  aria-label="Description"
                  value={receipt.description}
                  onChange={event => setReceipt({ ...receipt, description: event.target.value })}
                />
              </FormField>
              <FormField
                label="Date"
                labelClassName={receipt.fieldConfidence.date < 0.65 ? 'text-amber-600 dark:text-amber-400' : undefined}
              >
                <DatePicker
                  value={receipt.date ?? ''}
                  onChange={value => setReceipt({ ...receipt, date: value || null })}
                  className="w-full"
                  align="right"
                />
              </FormField>
            </div>
          </details>

          {(receipt.truncated || receipt.warnings.length > 0 || receipt.confidence < 0.7
            || calculation.hasMismatch || calculation.chargeBaseIncomplete || printedCurrency) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-4" /> Review the extracted receipt
              </div>
              {receipt.truncated && <p className="mt-1">Some visible receipt lines may be missing.</p>}
              {/* Nothing here converts: the figures are the receipt's own numbers, and saving one
                  records it as {currency}. Say so rather than relabel a foreign total silently. */}
              {printedCurrency && (
                <p className="mt-1">
                  This receipt is printed in {printedCurrency}, but every amount here is shown and
                  saved as {currency}. Convert your share yourself before saving it.
                </p>
              )}
              {receipt.warnings.map((warning, index) => <p key={index} className="mt-1">{warning}</p>)}
              {/* The lines and charges we read add up to something the receipt itself does not
                  print, so at least one of them is wrong — and your share is built from them. */}
              {calculation.hasMismatch && receipt.total != null && (
                <p className="mt-1">
                  These lines add up to {formatCurrencyVal(calculation.receiptComputedTotal, currency)},
                  but the receipt says {formatCurrencyVal(receipt.total, currency)}. Fix the prices before
                  trusting your share.
                </p>
              )}
              {calculation.chargeBaseIncomplete && (
                <p className="mt-1">
                  A charge is being split across lines with no readable price, which overstates your
                  share of it. Unlock those prices — including lines that are not yours.
                </p>
              )}
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h3 className="text-subsection">Items</h3>
              <p className="text-xs text-muted-foreground">
                Use −/+ for your quantity. Delete a line only if it was not on the receipt.
              </p>
            </div>

            {/* A receipt with nothing left on it is a dead end otherwise: the total reads zero,
                Use This Amount is disabled, and nothing says why or what to do about it. */}
            {receipt.items.length === 0 && (
              <p className="rounded-xl border border-border/60 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                No lines were read off this receipt, so there is nothing to split. Discard the scan
                and enter the amount yourself, or scan the receipt again.
              </p>
            )}

            {receipt.items.map((item, index) => (
              <ReceiptSplitItemRow
                key={index}
                item={item}
                index={index}
                currency={currency}
                maximum={receiptQuantity(item)}
                selected={selectedQuantities[index] ?? receiptQuantity(item)}
                priceUnlocked={unlockedPriceIndexes.has(index)}
                unitPrice={editableUnitPrice(item)}
                itemCalculation={itemCalculations[index]}
                onChangeQuantity={changeQuantity}
                onTogglePriceLock={togglePriceLock}
                onUpdatePrice={updatePrice}
                onRemove={removeItem}
              />
            ))}
          </section>

          <details className="group rounded-2xl border border-primary/20 bg-primary/5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold text-foreground">
              How your total was calculated
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-primary/20 p-4 text-xs">
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>The items you picked</span>
                <span className="font-semibold text-foreground">{formatCurrencyVal(calculation.itemSubtotal, currency)}</span>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Your share of tax, service and discounts</span>
                <span className="font-semibold text-foreground">
                  {formatCurrencyVal(calculation.total - calculation.itemSubtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-primary/20 pt-3 text-sm font-extrabold text-accent-ink">
                <span>What you pay</span>
                <span>{formatCurrencyVal(calculation.total, currency)}</span>
              </div>
            </div>
          </details>

          {calculation.invalidSelectedItemIndexes.length > 0 && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Unlock and correct the price for every selected item without a readable amount.
            </div>
          )}

          {/* Use This Amount is disabled below zero; without this the button was simply dead. */}
          {calculation.total < 0 && calculation.selectedItemCount > 0 && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              The discounts read off this receipt come to more than the items you picked, so your
              share works out below zero. Check the discount lines before using this amount.
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
