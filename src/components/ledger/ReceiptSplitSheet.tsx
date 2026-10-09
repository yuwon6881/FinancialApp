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

  const selectEvery = (all: boolean) => {
    if (!receipt) return
    setSelectedQuantities(receipt.items.map(item => all ? receiptQuantity(item) : 0))
  }

  const togglePriceLock =(index: number) => {
    setUnlockedPriceIndexes(current => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectedLines = receipt ? selectedQuantities.filter(quantity => quantity > 0).length : 0
  const hasNotices = Boolean(receipt && calculation && (receipt.truncated || receipt.warnings.length > 0
    || receipt.confidence < 0.7 || calculation.hasMismatch || calculation.chargeBaseIncomplete || printedCurrency))
  const shareReady = Boolean(calculation && calculation.invalidSelectedItemIndexes.length === 0)
  // The bar beside the hero figure: your share against the printed receipt, so "how much of this
  // bill is mine" reads at a glance before any line is opened.
  const shareOfReceipt = receipt?.total && calculation && shareReady && receipt.total > 0
    ? Math.min(100, Math.max(0, (calculation.total / receipt.total) * 100))
    : null

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Split receipt"
      maxWidthClassName="max-w-2xl"
      footer={receipt ? (
        <ModalActions>
          <Button variant="secondary" type="button" onClick={discardAndClose}>
            Discard
          </Button>
          <Button type="button" disabled={!canUse} onClick={useResult}>
            {canUse && calculation ? `Use ${formatCurrencyVal(calculation.total, currency)}` : 'Use this amount'}
          </Button>
        </ModalActions>
      ) : undefined}
    >
      {receipt && calculation && (
        <div className="space-y-6">
          {/* The answer first, and it stays in view while the lines below are adjusted. */}
          {/* Pinned over the sheet's own padding (the whole sheet scrolls), so lines never show
              through the strip above it. */}
          <section aria-label="Your share" className="sticky -top-4 z-10 -mx-4 -mt-4 bg-popover px-4 pb-4 pt-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-label text-muted-foreground">Your share</p>
                <strong
                  data-testid="receipt-share-total"
                  className={`mt-1 block text-display font-semibold tabular-nums sm:text-hero ${shareReady ? 'text-foreground' : 'text-amber-700 dark:text-amber-300'}`}
                >
                  {shareReady ? formatCurrencyVal(calculation.total, currency) : 'Price needed'}
                </strong>
              </div>
              <span className="shrink-0 pb-1.5 text-label text-muted-foreground tabular-nums">
                {selectedLines} of {receipt.items.length} item{receipt.items.length === 1 ? '' : 's'}
              </span>
            </div>
            {receipt.total != null && (
              <>
                {shareOfReceipt != null && (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-fluid" style={{ width: `${shareOfReceipt}%` }} />
                  </div>
                )}
                <p data-testid="receipt-share-context" className="mt-2 text-caption text-muted-foreground tabular-nums">
                  of {formatCurrencyVal(receipt.total, currency)} on the receipt
                  {shareOfReceipt != null && <> · {Math.round(shareOfReceipt)}%</>}
                </p>
              </>
            )}
          </section>

          {hasNotices && (
            <div className="rounded-control bg-amber-500/10 px-3.5 py-3 text-caption text-amber-700 dark:text-amber-300">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> Review the extracted receipt
              </p>
              <div className="mt-1 space-y-1 pl-6">
                {receipt.truncated && <p>Some visible receipt lines may be missing.</p>}
                {/* Nothing here converts: the figures are the receipt's own numbers, and saving one
                    records it as {currency}. Say so rather than relabel a foreign total silently. */}
                {printedCurrency && (
                  <p>
                    This receipt is printed in {printedCurrency}, but every amount here is shown and
                    saved as {currency}. Convert your share yourself before saving it.
                  </p>
                )}
                {receipt.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                {/* The lines and charges we read add up to something the receipt itself does not
                    print, so at least one of them is wrong — and your share is built from them. */}
                {calculation.hasMismatch && receipt.total != null && (
                  <p>
                    These lines add up to {formatCurrencyVal(calculation.receiptComputedTotal, currency)},
                    but the receipt says {formatCurrencyVal(receipt.total, currency)}. Fix the prices before
                    trusting your share.
                  </p>
                )}
                {calculation.chargeBaseIncomplete && (
                  <p>
                    A charge is being split across lines with no readable price, which overstates your
                    share of it. Unlock those prices — including lines that are not yours.
                  </p>
                )}
              </div>
            </div>
          )}

          <section aria-labelledby="receipt-items-heading">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h3 id="receipt-items-heading" className="text-subsection text-foreground">
                Items
              </h3>
              {receipt.items.length > 0 && (
                <div className="-mr-2.5 flex shrink-0 items-center">
                  <Button variant="tertiary" size="sm" type="button" onClick={() => selectEvery(true)} className="text-accent-ink">
                    Select all
                  </Button>
                  <Button variant="tertiary" size="sm" type="button" onClick={() => selectEvery(false)} className="text-muted-foreground">
                    Clear all
                  </Button>
                </div>
              )}
            </div>

            {/* A receipt with nothing left on it is a dead end otherwise: the total reads zero,
                Use is disabled, and nothing says why or what to do about it. */}
            {receipt.items.length === 0 ? (
              <p className="rounded-control bg-surface-2/70 px-3 py-4 text-center text-caption text-muted-foreground">
                No lines were read off this receipt, so there is nothing to split. Discard the scan
                and enter the amount yourself, or scan the receipt again.
              </p>
            ) : (
              <div className="divide-y divide-border/60 overflow-hidden rounded-panel border border-border/70 bg-card">
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
              </div>
            )}
          </section>

          {calculation.invalidSelectedItemIndexes.length > 0 && (
            <p className="rounded-control bg-destructive/10 px-3.5 py-2.5 text-caption text-destructive">
              Unlock and correct the price for every selected item without a readable amount.
            </p>
          )}

          {/* Use is disabled below zero; without this the button was simply dead. */}
          {calculation.total < 0 && calculation.selectedItemCount > 0 && (
            <p className="rounded-control bg-destructive/10 px-3.5 py-2.5 text-caption text-destructive">
              The discounts read off this receipt come to more than the items you picked, so your
              share works out below zero. Check the discount lines before using this amount.
            </p>
          )}

          {/* The secondary material, folded: what the receipt was, and how the answer was reached. */}
          <div className="divide-y divide-border/60 overflow-hidden rounded-panel border border-border/70 bg-card">
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-medium text-foreground">
                <span className="shrink-0">Receipt details</span>
                <span className="flex min-w-0 items-center gap-2 text-caption font-normal text-muted-foreground">
                  <span className="truncate">{[receipt.description, receipt.date].filter(Boolean).join(' · ')}</span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]">
                <FormField
                  label="Description"
                  labelClassName={receipt.fieldConfidence.description < 0.65 ? 'text-amber-700 dark:text-amber-300' : undefined}
                >
                  <Input
                    aria-label="Description"
                    value={receipt.description}
                    onChange={event => setReceipt({ ...receipt, description: event.target.value })}
                  />
                </FormField>
                <FormField
                  label="Date"
                  labelClassName={receipt.fieldConfidence.date < 0.65 ? 'text-amber-700 dark:text-amber-300' : undefined}
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
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-medium text-foreground">
                How your total was calculated
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <dl className="space-y-2 px-4 pb-4 text-caption">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">The items you picked</dt>
                  <dd className="text-foreground tabular-nums">{formatCurrencyVal(calculation.itemSubtotal, currency)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Your share of tax, service and discounts</dt>
                  <dd className="text-foreground tabular-nums">{formatCurrencyVal(calculation.total - calculation.itemSubtotal, currency)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border/60 pt-2 text-body font-semibold text-foreground">
                  <dt>What you pay</dt>
                  <dd className="tabular-nums">{formatCurrencyVal(calculation.total, currency)}</dd>
                </div>
              </dl>
            </details>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
