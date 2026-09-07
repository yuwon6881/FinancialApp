import { ChevronDown, Lock, Minus, Plus, Trash2, Unlock } from 'lucide-react'
import type { ReceiptSplitItem } from '../../lib/api'
import type { ReceiptShareCalculation } from '../../lib/receiptSplitCalculator'
import { formatCurrencyVal } from '../../lib/utils'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { InfoHint } from '../ui/InfoHint'
import { Input } from '../ui/Input'
import { SwipeableRow } from '../ui/SwipeableRow'

interface Props {
  item: ReceiptSplitItem
  index: number
  currency: string
  /** The receipt quantity — the ceiling on how many of this line can be yours. */
  maximum: number
  selected: number
  priceUnlocked: boolean
  unitPrice: number | null
  /** This line costed on its own, so the row can show a share without re-running the whole receipt. */
  itemCalculation: ReceiptShareCalculation | undefined
  onChangeQuantity: (index: number, delta: number) => void
  onTogglePriceLock: (index: number) => void
  onUpdatePrice: (index: number, value: string) => void
  onRemove: (index: number) => void
}

function inputNumber(value: number | null): string {
  return value == null ? '' : String(Number(value.toFixed(6)))
}

/**
 * One scanned line, with the two different ways to take it off your bill.
 *
 * Setting the quantity to 0 means "none of this one is mine" and is the one to reach for: the line
 * stays on the receipt, so a printed charge (a flat service fee, say) keeps being spread over the
 * whole bill. Deleting removes the line entirely, which shrinks that denominator and quietly grows
 * everyone else's share of the fee — right only when the scan invented a line that was never there.
 */
export function ReceiptSplitItemRow({
  item,
  index,
  currency,
  maximum,
  selected,
  priceUnlocked,
  unitPrice,
  itemCalculation,
  onChangeQuantity,
  onTogglePriceLock,
  onUpdatePrice,
  onRemove,
}: Props) {
  const isExcluded = selected <= 0
  const lowConfidence = item.confidence < 0.65
  const itemLabel = item.name.trim() || `Item ${index + 1}`
  const chargeAmount = itemCalculation ? itemCalculation.total - itemCalculation.itemSubtotal : 0
  const chargePercent = itemCalculation && itemCalculation.itemSubtotal > 0
    ? (chargeAmount / itemCalculation.itemSubtotal) * 100
    : 0

  return (
    <SwipeableRow
      actionsWidth={88}
      actions={(
        <Button variant="tertiary"
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-full w-full items-center justify-center gap-1 bg-destructive hover:bg-destructive/90 px-3 text-xs font-bold text-destructive-foreground cursor-pointer"
          aria-label={`Delete ${itemLabel}`}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      // Delete belongs beside the line's name, not in the trailing slot. From `sm:` up there is no
      // drawer, so SwipeableRow parked it in a column of its own and centred it against a card four
      // rows tall -- it came out floating beside the price disclosure, reading as that row's
      // control rather than the whole line's. The row renders its own instead, on the name's line.
      desktopActions={false}
      className={`rounded-2xl border shadow-xs ${lowConfidence ? 'border-amber-500/40' : 'border-border'}`}
      contentClassName={`rounded-2xl p-3 sm:p-4 bg-card ${lowConfidence ? 'before:absolute before:inset-0 before:bg-amber-500/10 before:rounded-2xl before:pointer-events-none relative' : ''}`}
    >
      <div className={`relative space-y-3 transition-opacity ${isExcluded ? 'opacity-60' : ''}`}>
        <div className="flex min-w-0 items-start gap-2 px-1">
          <h4 className="min-w-0 flex-1 text-sm font-bold text-foreground">{itemLabel}</h4>
          <IconButton
            variant="tertiary"
            type="button"
            onClick={() => onRemove(index)}
            label={`Delete ${itemLabel}`}
            tooltip="Delete this line"
            className="-mt-1 hidden shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:inline-flex"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>

        <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${isExcluded ? 'bg-muted/30' : 'bg-accent'}`}>
          <div className="min-w-0">
            <span className={`block text-eyebrow uppercase ${isExcluded ? 'text-muted-foreground' : 'text-accent-ink'}`}>
              {isExcluded ? 'Not yours' : 'Your share for this item'}
            </span>
            <strong className="mt-0.5 block truncate text-sm font-extrabold text-foreground">
              {isExcluded ? 'Nothing to pay' : formatCurrencyVal(itemCalculation?.total ?? 0, currency)}
            </strong>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{selected} of {maximum}</span>
        </div>

        <details className="group rounded-xl border border-border/50 bg-muted/15">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-muted-foreground">
            Price and charge breakdown
            <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          {/* Price takes the whole first line on a phone. Sharing a 2-column row with Extras left
              each tile under a hundred pixels of content: the number input was clipped to a couple
              of digits, and its 44px lock button took most of what was left. Extras and With
              extras are short enough to keep sharing the second line at every width. */}
          <div className="grid min-w-0 grid-cols-2 gap-2 border-t border-border/40 p-2.5 sm:grid-cols-3">
            <div className="col-span-2 min-w-0 rounded-xl border border-border/60 bg-muted/25 p-2.5 sm:col-span-1">
              <span className="block text-eyebrow uppercase text-muted-foreground">Price</span>
              <div className="mt-1 flex min-w-0 items-center gap-1">
                <Input
                  aria-label={`Item ${index + 1} price`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={inputNumber(unitPrice)}
                  onChange={event => onUpdatePrice(index, event.target.value)}
                  disabled={!priceUnlocked}
                  controlSize="sm"
                  className="min-w-0 flex-1 font-bold"
                />
                <Button
                  size="icon"
                  variant="tertiary"
                  type="button"
                  onClick={() => onTogglePriceLock(index)}
                  className="shrink-0 rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  title={priceUnlocked ? 'Lock' : 'Unlock'}
                  aria-label={`${priceUnlocked ? 'Lock' : 'Unlock'} price for item ${index + 1}`}
                >
                  {priceUnlocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5 text-accent-ink" />}
                </Button>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-border/60 bg-muted/25 p-2.5">
              <span className="flex items-center gap-1 text-eyebrow uppercase text-muted-foreground">
                {/* The rate lives under the figure, not inside the label. Appended to "Extras" it
                    made a string no phone-width tile could hold, and `truncate` ate it. */}
                <span className="min-w-0 truncate">Extras</span>
                <InfoHint
                  label="What the extras on this line are"
                  text="Tax, service charges, and discounts are split across applicable items. This line's share."
                  align="left"
                />
              </span>
              {/* A line nobody is taking pays none of the receipt's extras. The figures here are
                  costed at one unit so the panel can still show what the line is worth, which read
                  as a bill for something the summary above had already called "Nothing to pay". */}
              <span className={`mt-2 block truncate text-xs font-bold ${isExcluded ? 'text-muted-foreground' : chargeAmount < 0 ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                {isExcluded
                  ? '—'
                  : <>{chargeAmount < 0 ? '−' : '+'}{formatCurrencyVal(Math.abs(chargeAmount), currency)}</>}
              </span>
              {!isExcluded && Math.abs(chargePercent) >= 0.05 && (
                <span className="mt-0.5 block truncate text-eyebrow text-muted-foreground">
                  {Math.abs(chargePercent).toFixed(1)}% of this line
                </span>
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-primary/25 bg-primary/10 p-2.5">
              <span className="block text-eyebrow uppercase text-accent-ink">With extras</span>
              <span className="mt-2 block truncate text-xs font-extrabold text-accent-ink">
                {isExcluded ? '—' : formatCurrencyVal(itemCalculation?.total ?? 0, currency)}
              </span>
            </div>
          </div>
        </details>

        {/* The stepper is three 44px targets wide on a phone, which left its caption about 180px
            and broke "0 if none is yours" over three lines with one word alone on the last. Below
            the medium tier the caption takes the line and the stepper sits on the trailing edge
            under it. */}
        <div className="flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <span className="block text-eyebrow uppercase text-muted-foreground">How many are yours</span>
            <span className="text-xs text-muted-foreground">{maximum} on the receipt · 0 if none is yours</span>
          </div>
          <div className="flex shrink-0 items-center self-end rounded-xl border border-border bg-background p-1 shadow-xs sm:self-auto">
            <Button size="icon" variant="tertiary"
              type="button"
              onClick={() => onChangeQuantity(index, -1)}
              disabled={selected <= 0}
              className="rounded-lg text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Decrease quantity for item ${index + 1}`}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="min-w-9 text-center text-sm font-extrabold text-foreground" aria-label={`Quantity for item ${index + 1}`}>
              {selected}
            </span>
            <Button size="icon" variant="tertiary"
              type="button"
              onClick={() => onChangeQuantity(index, 1)}
              disabled={selected >= maximum}
              className="rounded-lg text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Increase quantity for item ${index + 1}`}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </SwipeableRow>
  )
}
