import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Lock, Minus, Plus, Trash2, Unlock } from 'lucide-react'
import {
  startReceiptSplitScan,
  type ReceiptSplitItem,
  type ReceiptSplitScanResult,
} from '../../lib/api'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../lib/useReceiptSplitPolling'
import { calculateReceiptShare } from '../../lib/receiptSplitCalculator'
import { getErrorMessage } from '../../lib/errors'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
import { DatePicker } from '../ui/DatePicker'
import { SwipeableRow } from '../ui/SwipeableRow'
import { ReceiptScanPicker } from './transaction-form/ReceiptScanPicker'
import type { TransactionPrefillDraft } from './TransactionFormSheet'

interface Props {
  isOpen: boolean
  currency: string
  draft: ReceiptSplitDraft | null
  failedJob: ReceiptSplitFailure | null
  activeJobIds: string[]
  onStarted: (scanId: string) => void
  onClear: (scanId: string) => void | Promise<void>
  onClose: () => void
  onUseResult: (draft: TransactionPrefillDraft) => void
}

const inputClassName = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition hover:border-border/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'

function receiptQuantity(item: ReceiptSplitItem): number {
  return Math.max(1, Math.floor(item.quantity))
}

function editableUnitPrice(item: ReceiptSplitItem): number | null {
  if (item.unitPrice != null && Number.isFinite(item.unitPrice)) return item.unitPrice
  const quantity = receiptQuantity(item)
  if (item.lineTotal != null && Number.isFinite(item.lineTotal)) return item.lineTotal / quantity
  return null
}

function inputNumber(value: number | null): string {
  return value == null ? '' : String(Number(value.toFixed(6)))
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
  failedJob,
  activeJobIds,
  onStarted,
  onClear,
  onClose,
  onUseResult,
}: Props) {
  const [receipt, setReceipt] = useState<ReceiptSplitScanResult | null>(null)
  const [selectedQuantities, setSelectedQuantities] = useState<number[]>([])
  const [unlockedPriceIndexes, setUnlockedPriceIndexes] = useState<Set<number>>(new Set())
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
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
    setIsScanning(false)
    setScanError(null)
  }, [draft])

  useEffect(() => {
    if (!failedJob || failedJob.jobId !== activeJobId) return
    setScanError(failedJob.errorMessage)
    setIsScanning(false)
    setActiveJobId(null)
  }, [failedJob, activeJobId])

  useEffect(() => {
    if (!activeJobId || activeJobIds.includes(activeJobId) || draft?.jobId === activeJobId) return
    if (!failedJob || failedJob.jobId !== activeJobId) return
    setIsScanning(false)
  }, [activeJobId, activeJobIds, draft, failedJob])

  const calculation = useMemo(
    () => receipt ? calculateReceiptShare(receipt, selectedQuantities) : null,
    [receipt, selectedQuantities],
  )

  const itemCalculations = useMemo(() => {
    if (!receipt) return []
    return receipt.items.map((_, itemIndex) => {
      const quantities = receipt.items.map((__, index) => index === itemIndex ? 1 : 0)
      return calculateReceiptShare(receipt, quantities)
    })
  }, [receipt])

  const canUse = Boolean(
    receipt
    && calculation
    && calculation.selectedItemCount > 0
    && calculation.invalidSelectedItemIndexes.length === 0
    && calculation.total >= 0,
  )

  const closeAndClear = () => {
    if (activeJobId) void onClear(activeJobId)
    setReceipt(null)
    setSelectedQuantities([])
    setUnlockedPriceIndexes(new Set())
    setActiveJobId(null)
    setIsScanning(false)
    setScanError(null)
    appliedJobRef.current = null
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
    closeAndClear()
  }

  const handleScan = async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setReceipt(null)
    try {
      const started = await startReceiptSplitScan(file)
      setActiveJobId(started.scanId)
      onStarted(started.scanId)
    } catch (error: unknown) {
      setScanError(getErrorMessage(error, 'Could not scan this receipt. Please try a clearer photo.'))
      setIsScanning(false)
    } finally {
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  const updateItem = (index: number, update: Partial<ReceiptSplitItem>) => {
    setReceipt(current => current ? {
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item),
    } : current)
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
    setReceipt(current => current ? {
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
      charges: current.charges.map(charge => ({
        ...charge,
        eligibleItemIndexes: charge.eligibleItemIndexes
          .filter(itemIndex => itemIndex !== index)
          .map(itemIndex => itemIndex > index ? itemIndex - 1 : itemIndex),
      })),
    } : current)
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
    setSelectedQuantities(current => current.map((quantity, itemIndex) =>
      itemIndex === index ? Math.max(1, Math.min(maximum, quantity + delta)) : quantity))
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
      onClose={closeAndClear}
      title="Split Receipt"
      maxWidthClassName="max-w-3xl"
      footer={receipt ? (
        <div className="flex gap-3">
          <button type="button" onClick={closeAndClear} className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold hover:bg-muted cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canUse}
            onClick={useResult}
            className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
          >
            Use This Amount
          </button>
        </div>
      ) : undefined}
    >
      {!receipt && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan the shared receipt, then adjust the quantities to keep only your items.
          </p>
          <ReceiptScanPicker
            isScanning={isScanning}
            showScanPicker={showPicker}
            setShowScanPicker={setShowPicker}
            scanFileInputRef={cameraRef}
            scanGalleryInputRef={galleryRef}
            handleScanReceipt={handleScan}
            setScanError={setScanError}
            label="Scan Shared Receipt"
            scanningLabel="Reading receipt items..."
          />
          {scanError && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {scanError}
            </div>
          )}
        </div>
      )}

      {receipt && calculation && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]">
            <label className={`min-w-0 text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.description < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Description
              <input
                aria-label="Description"
                value={receipt.description}
                onChange={event => setReceipt({ ...receipt, description: event.target.value })}
                className={`mt-1 ${inputClassName}`}
              />
            </label>
            <label className={`min-w-0 text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.date < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Date
              <DatePicker
                value={receipt.date ?? ''}
                onChange={value => setReceipt({ ...receipt, date: value || null })}
                className="mt-1 w-full"
                align="right"
              />
            </label>
          </div>

          {(receipt.truncated || receipt.warnings.length > 0 || receipt.confidence < 0.7) && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-4" /> Review the extracted receipt
              </div>
              {receipt.truncated && <p className="mt-1">Some visible receipt lines may be missing.</p>}
              {receipt.warnings.map((warning, index) => <p key={index} className="mt-1">{warning}</p>)}
            </div>
          )}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold">Items</h3>
              <p className="text-[11px] text-muted-foreground">
                Adjust your quantity with − and +. Swipe an item left on mobile to delete it.
              </p>
            </div>

            {receipt.items.map((item, index) => {
              const maximum = receiptQuantity(item)
              const selected = selectedQuantities[index] ?? maximum
              const priceUnlocked = unlockedPriceIndexes.has(index)
              const itemCalculation = itemCalculations[index]
              const unitPrice = editableUnitPrice(item)
              const chargeAmount = itemCalculation ? itemCalculation.total - itemCalculation.itemSubtotal : 0
              const chargePercent = itemCalculation && itemCalculation.itemSubtotal > 0
                ? (chargeAmount / itemCalculation.itemSubtotal) * 100
                : 0
              const deleteButton = (
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="flex h-full items-center justify-center gap-1 bg-red-500 px-3 text-[11px] font-bold text-destructive-foreground cursor-pointer"
                  aria-label={`Delete ${item.name || `item ${index + 1}`}`}
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              )

              return (
                <SwipeableRow
                  key={index}
                  actionsWidth={88}
                  actions={deleteButton}
                  desktopActions={(
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                      aria-label={`Delete ${item.name || `item ${index + 1}`}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                  className={`rounded-2xl border shadow-xs ${item.confidence < 0.65 ? 'border-amber-500/40' : 'border-border'}`}
                  contentClassName={`rounded-2xl p-3 sm:p-4 ${item.confidence < 0.65 ? 'bg-amber-500/5' : 'bg-card'}`}
                >
                  <div className="space-y-3">
                    <input
                      aria-label={`Item ${index + 1} name`}
                      value={item.name}
                      onChange={event => updateItem(index, { name: event.target.value })}
                      placeholder="Item name"
                      className={inputClassName}
                    />

                    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="min-w-0 rounded-xl border border-border/60 bg-muted/25 p-2.5">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Price</span>
                        <div className="mt-1 flex min-w-0 items-center gap-1">
                          <input
                            aria-label={`Item ${index + 1} price`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={inputNumber(unitPrice)}
                            onChange={event => updatePrice(index, event.target.value)}
                            disabled={!priceUnlocked}
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-bold text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => togglePriceLock(index)}
                            className="p-1 inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                            title={priceUnlocked ? 'Lock' : 'Unlock'}
                            aria-label={`${priceUnlocked ? 'Lock' : 'Unlock'} price for item ${index + 1}`}
                          >
                            {priceUnlocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5 text-blue-500" />}
                          </button>
                        </div>
                      </div>

                      <div className="min-w-0 rounded-xl border border-border/60 bg-muted/25 p-2.5">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                          Charges{Math.abs(chargePercent) >= 0.01 ? ` (${Math.abs(chargePercent).toFixed(2).replace(/\.?0+$/, '')}%)` : ''}
                        </span>
                        <span className={`mt-2 block truncate text-xs font-bold ${chargeAmount < 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {chargeAmount < 0 ? '−' : '+'}{formatCurrencyVal(Math.abs(chargeAmount), currency)}
                        </span>
                      </div>

                      <div className="col-span-2 min-w-0 rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 sm:col-span-1">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-blue-500">After charges</span>
                        <span className="mt-2 block truncate text-xs font-extrabold text-blue-500">
                          {formatCurrencyVal(itemCalculation?.total ?? 0, currency)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Your quantity</span>
                        <span className="text-[10px] text-muted-foreground">Receipt quantity: {maximum}</span>
                      </div>
                      <div className="flex items-center rounded-xl border border-border bg-background p-1 shadow-xs">
                        <button
                          type="button"
                          onClick={() => changeQuantity(index, -1)}
                          disabled={selected <= 1}
                          className="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                          aria-label={`Decrease quantity for item ${index + 1}`}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-9 text-center text-sm font-extrabold text-foreground" aria-label={`Quantity for item ${index + 1}`}>
                          {selected}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeQuantity(index, 1)}
                          disabled={selected >= maximum}
                          className="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
                          aria-label={`Increase quantity for item ${index + 1}`}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </SwipeableRow>
              )
            })}
          </section>

          <section className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4">
            <h3 className="text-sm font-bold">Your total</h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Selected subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrencyVal(calculation.itemSubtotal, currency)}</span>
              </div>
              <div className="flex justify-between gap-4 text-muted-foreground">
                <span>Combined charges and adjustments</span>
                <span className="font-semibold text-foreground">
                  {formatCurrencyVal(calculation.total - calculation.itemSubtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-blue-500/20 pt-3 text-sm font-extrabold text-blue-500">
                <span>Total after charges</span>
                <span>{formatCurrencyVal(calculation.total, currency)}</span>
              </div>
            </div>
          </section>

          {calculation.invalidSelectedItemIndexes.length > 0 && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Unlock and correct the price for every selected item without a readable amount.
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
