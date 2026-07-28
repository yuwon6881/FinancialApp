import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import {
  startReceiptSplitScan,
  type ReceiptSplitCharge,
  type ReceiptSplitItem,
  type ReceiptSplitScanResult,
} from '../../lib/api'
import type { ReceiptSplitDraft, ReceiptSplitFailure } from '../../lib/useReceiptSplitPolling'
import { calculateReceiptShare } from '../../lib/receiptSplitCalculator'
import { getErrorMessage } from '../../lib/errors'
import { formatCurrencyVal } from '../../lib/utils'
import { BottomSheet } from '../ui/BottomSheet'
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

const emptyItem = (): ReceiptSplitItem => ({
  name: '',
  quantity: 1,
  unitPrice: null,
  lineTotal: null,
  confidence: 1,
})

const emptyCharge = (sequence: number): ReceiptSplitCharge => ({
  label: 'Other charge',
  kind: 'other',
  operation: 'add',
  basis: 'subtotal',
  amount: null,
  ratePercent: null,
  sequence,
  eligibleItemIndexes: [],
  confidence: 1,
})

function inputNumber(value: number | null): string {
  return value == null ? '' : String(value)
}

function parsedNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.abs(parsed) : null
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
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [mismatchReviewed, setMismatchReviewed] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const appliedJobRef = useRef<string | null>(null)

  useEffect(() => {
    if (!draft || appliedJobRef.current === draft.jobId) return
    appliedJobRef.current = draft.jobId
    setActiveJobId(draft.jobId)
    setReceipt(draft.result)
    setSelectedQuantities(draft.result.items.map(() => 0))
    setIsScanning(false)
    setScanError(null)
    setMismatchReviewed(false)
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

  const closeAndClear = () => {
    if (activeJobId) void onClear(activeJobId)
    setReceipt(null)
    setSelectedQuantities([])
    setActiveJobId(null)
    setIsScanning(false)
    setScanError(null)
    setMismatchReviewed(false)
    appliedJobRef.current = null
    onClose()
  }

  const handleScan = async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setReceipt(null)
    setMismatchReviewed(false)
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
    setMismatchReviewed(false)
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
    setMismatchReviewed(false)
  }

  const updateCharge = (index: number, update: Partial<ReceiptSplitCharge>) => {
    setReceipt(current => current ? {
      ...current,
      charges: current.charges.map((charge, chargeIndex) =>
        chargeIndex === index ? { ...charge, ...update } : charge),
    } : current)
    setMismatchReviewed(false)
  }

  const addItem = () => {
    setReceipt(current => current ? { ...current, items: [...current.items, emptyItem()] } : current)
    setSelectedQuantities(current => [...current, 0])
    setMismatchReviewed(false)
  }

  const canUse = Boolean(
    receipt
    && calculation
    && calculation.selectedItemCount > 0
    && calculation.invalidSelectedItemIndexes.length === 0
    && calculation.total >= 0
    && (!calculation.hasMismatch || mismatchReviewed),
  )

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={closeAndClear}
      title="Split Receipt"
      maxWidthClassName="max-w-3xl"
    >
      {!receipt && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan the shared receipt, then choose only your dishes or purchases. AI reads the receipt;
            the amount is calculated locally and shown before anything is added to your ledger.
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={`sm:col-span-2 text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.description < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Merchant
              <input
                value={receipt.description}
                onChange={event => setReceipt({ ...receipt, description: event.target.value })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className={`text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.date < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Date
              <input
                type="date"
                value={receipt.date ?? ''}
                onChange={event => setReceipt({ ...receipt, date: event.target.value || null })}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className={`text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.subtotal < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Receipt subtotal
              <input
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(receipt.subtotal)}
                onChange={event => {
                  setReceipt({ ...receipt, subtotal: parsedNumber(event.target.value) })
                  setMismatchReviewed(false)
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className={`text-xs font-semibold text-muted-foreground ${receipt.fieldConfidence.total < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              Printed total
              <input
                type="number"
                min="0"
                step="0.01"
                value={inputNumber(receipt.total)}
                onChange={event => {
                  setReceipt({ ...receipt, total: parsedNumber(event.target.value) })
                  setMismatchReviewed(false)
                }}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className={`flex items-end text-xs text-muted-foreground ${receipt.fieldConfidence.currency < 0.65 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {receipt.currency ? `Detected currency: ${receipt.currency}` : `Using account currency: ${currency}`}
            </div>
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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Items</h3>
                <p className="text-[11px] text-muted-foreground">Set “My quantity” to 0 for items that are not yours.</p>
              </div>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-blue-500 cursor-pointer">
                <Plus className="size-3.5" /> Add item
              </button>
            </div>
            {receipt.items.map((item, index) => (
              <div
                key={index}
                className={`rounded-xl border p-3 ${item.confidence < 0.65 ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-background/40'}`}
              >
                <div className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_0.65fr_0.8fr_0.8fr_auto]">
                  <input
                    aria-label={`Item ${index + 1} name`}
                    value={item.name}
                    onChange={event => updateItem(index, { name: event.target.value })}
                    placeholder="Item name"
                    className="min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                  />
                  <input
                    aria-label={`Item ${index + 1} receipt quantity`}
                    type="number"
                    min="0.000001"
                    step="0.01"
                    value={item.quantity}
                    onChange={event => updateItem(index, { quantity: parsedNumber(event.target.value) || 1 })}
                    className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                    title="Receipt quantity"
                  />
                  <input
                    aria-label={`Item ${index + 1} unit price`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputNumber(item.unitPrice)}
                    onChange={event => updateItem(index, { unitPrice: parsedNumber(event.target.value) })}
                    placeholder="Unit price"
                    className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                  />
                  <input
                    aria-label={`Item ${index + 1} line total`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputNumber(item.lineTotal)}
                    onChange={event => updateItem(index, { lineTotal: parsedNumber(event.target.value) })}
                    placeholder="Line total"
                    className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
                  />
                  <button type="button" onClick={() => removeItem(index)} className="rounded-lg px-2 text-destructive hover:bg-destructive/10 cursor-pointer" aria-label={`Remove item ${index + 1}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">My quantity</span>
                  <input
                    aria-label={`My quantity for item ${index + 1}`}
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="any"
                    value={selectedQuantities[index] ?? 0}
                    onChange={event => {
                      const value = Math.min(parsedNumber(event.target.value) ?? 0, item.quantity)
                      setSelectedQuantities(current => current.map((quantity, itemIndex) => itemIndex === index ? value : quantity))
                    }}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  />
                  {[0.25, 1 / 3, 0.5].map(fraction => (
                    <button
                      key={fraction}
                      type="button"
                      onClick={() => setSelectedQuantities(current =>
                        current.map((quantity, itemIndex) => itemIndex === index ? Math.min(fraction, item.quantity) : quantity))}
                      className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted cursor-pointer"
                    >
                      {fraction === 0.25 ? '¼' : fraction === 0.5 ? '½' : '⅓'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedQuantities(current =>
                      current.map((quantity, itemIndex) => itemIndex === index ? item.quantity : quantity))}
                    className="rounded-lg border border-border px-2 py-1 text-[11px] font-bold hover:bg-muted cursor-pointer"
                  >
                    All
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Taxes, service and adjustments</h3>
                <p className="text-[11px] text-muted-foreground">Printed amounts take priority over percentages.</p>
              </div>
              <button
                type="button"
                onClick={() => setReceipt({ ...receipt, charges: [...receipt.charges, emptyCharge(receipt.charges.length)] })}
                className="flex items-center gap-1 text-xs font-bold text-blue-500 cursor-pointer"
              >
                <Plus className="size-3.5" /> Add charge
              </button>
            </div>
            {receipt.charges.map((charge, index) => (
              <div key={index} className={`rounded-xl border p-3 ${charge.confidence < 0.65 ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
                <div className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.75fr_0.75fr_auto]">
                  <input
                    value={charge.label}
                    onChange={event => updateCharge(index, { label: event.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Charge ${index + 1} label`}
                  />
                  <select
                    value={charge.operation}
                    onChange={event => updateCharge(index, { operation: event.target.value as ReceiptSplitCharge['operation'] })}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Charge ${index + 1} operation`}
                  >
                    <option value="add">Add</option>
                    <option value="subtract">Subtract</option>
                    <option value="included">Included</option>
                  </select>
                  <select
                    value={charge.basis}
                    onChange={event => updateCharge(index, { basis: event.target.value as ReceiptSplitCharge['basis'] })}
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Charge ${index + 1} basis`}
                  >
                    <option value="subtotal">On subtotal</option>
                    <option value="runningTotal">After prior charges</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputNumber(charge.amount)}
                    onChange={event => updateCharge(index, { amount: parsedNumber(event.target.value) })}
                    placeholder="Amount"
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Charge ${index + 1} amount`}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={inputNumber(charge.ratePercent)}
                    onChange={event => updateCharge(index, { ratePercent: parsedNumber(event.target.value) })}
                    placeholder="%"
                    className="rounded-lg border border-border bg-background px-2 py-2 text-xs"
                    aria-label={`Charge ${index + 1} percentage`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setReceipt({ ...receipt, charges: receipt.charges.filter((_, chargeIndex) => chargeIndex !== index) })
                      setMismatchReviewed(false)
                    }}
                    className="rounded-lg px-2 text-destructive hover:bg-destructive/10 cursor-pointer"
                    aria-label={`Remove charge ${index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2">
                  <span className="mr-2 text-[11px] font-bold text-muted-foreground">Applies to</span>
                  <button
                    type="button"
                    onClick={() => updateCharge(index, { eligibleItemIndexes: [] })}
                    className={`mr-1 rounded-md border px-2 py-1 text-[10px] font-bold cursor-pointer ${charge.eligibleItemIndexes.length === 0 ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border'}`}
                  >
                    All items
                  </button>
                  {receipt.items.map((item, itemIndex) => {
                    const active = charge.eligibleItemIndexes.includes(itemIndex)
                    return (
                      <button
                        key={itemIndex}
                        type="button"
                        onClick={() => {
                          const current = charge.eligibleItemIndexes
                          const next = current.length === 0
                            ? [itemIndex]
                            : active
                              ? current.filter(value => value !== itemIndex)
                              : [...current, itemIndex]
                          updateCharge(index, {
                            eligibleItemIndexes: next.length === receipt.items.length ? [] : next,
                          })
                        }}
                        className={`mr-1 mt-1 max-w-28 truncate rounded-md border px-2 py-1 text-[10px] cursor-pointer ${active ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-border'}`}
                        title={item.name}
                      >
                        {item.name || `Item ${itemIndex + 1}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">My calculation</h3>
              <span className="text-lg font-extrabold text-blue-500">{formatCurrencyVal(calculation.total, currency)}</span>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between"><span>Selected items</span><span>{formatCurrencyVal(calculation.itemSubtotal, currency)}</span></div>
              {calculation.chargeLines.map((line, index) => (
                <div key={index} className="flex justify-between text-muted-foreground">
                  <span>
                    {line.label}{line.ratePercent != null ? ` (${line.ratePercent}%)` : ''}
                    {line.operation === 'included' ? ' — included' : ''}
                  </span>
                  <span>
                    {line.operation === 'subtract' ? '−' : line.operation === 'add' ? '+' : ''}
                    {formatCurrencyVal(line.amount, currency)}
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t border-blue-500/20 pt-2 font-bold">
                {formatCurrencyVal(calculation.itemSubtotal, currency)}
                {calculation.chargeLines.map((line, index) => line.operation === 'included' ? null : (
                  <span key={index}> {line.operation === 'subtract' ? '−' : '+'} {formatCurrencyVal(line.amount, currency)}</span>
                ))}
                {' = '}{formatCurrencyVal(calculation.total, currency)}
              </div>
            </div>
          </section>

          {calculation.hasMismatch && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-4" />
                Receipt does not reconcile
              </div>
              <p className="mt-1">
                Extracted calculation is {formatCurrencyVal(calculation.receiptComputedTotal, currency)};
                printed total is {formatCurrencyVal(receipt.total ?? 0, currency)}.
                Review the item and charge values before continuing.
              </p>
              <label className="mt-2 flex items-center gap-2 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={mismatchReviewed}
                  onChange={event => setMismatchReviewed(event.target.checked)}
                />
                I reviewed this mismatch and want to continue
              </label>
            </div>
          )}

          {calculation.invalidSelectedItemIndexes.length > 0 && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Add a line total or unit price for every selected item.
            </div>
          )}

          {!calculation.hasMismatch && receipt.total != null && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Extracted values reconcile with the printed total.
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={closeAndClear} className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold hover:bg-muted cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              disabled={!canUse}
              onClick={() => {
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
              }}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
            >
              Use This Amount
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
