import { useId, useState } from 'react'
import { ChevronDown, Lock, Minus, Plus, Trash2, Unlock } from 'lucide-react'
import type { ReceiptSplitItem } from '../../lib/api'
import type { ReceiptShareCalculation } from '../../lib/receiptSplitCalculator'
import { cn, formatCurrencyVal } from '../../lib/utils'
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
 * One scanned line as one flat row of the receipt list: what it is, how many are yours, and what
 * that costs you. The price and its share of tax and service fold away underneath.
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
  const [showBreakdown, setShowBreakdown] = useState(false)
  const breakdownId = useId()
  const isExcluded = selected <= 0
  const lowConfidence = item.confidence < 0.65
  const itemLabel = item.name.trim() || `Item ${index + 1}`
  // A line with no readable price costs nothing in the sum, but that is unknown, not free.
  const needsPrice = !isExcluded && (itemCalculation?.invalidSelectedItemIndexes.length ?? 0) > 0
  const chargeAmount = itemCalculation ? itemCalculation.total - itemCalculation.itemSubtotal : 0
  const chargePercent = itemCalculation && itemCalculation.itemSubtotal > 0
    ? (chargeAmount / itemCalculation.itemSubtotal) * 100
    : 0
  const priceLine = unitPrice == null
    ? 'No readable price'
    : `${maximum > 1 ? `${maximum} × ` : ''}${formatCurrencyVal(unitPrice, currency)}`

  return (
    <SwipeableRow
      variant="flush"
      actionsWidth={88}
      actions={(
        <Button variant="tertiary"
          type="button"
          onClick={() => onRemove(index)}
          className="flex h-full w-full items-center justify-center gap-1 bg-destructive px-3 text-caption font-semibold text-destructive-foreground hover:bg-destructive/90"
          aria-label={`Delete ${itemLabel}`}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      desktopActions={false}
      contentClassName={cn('group/line px-4 py-3.5', lowConfidence && 'bg-amber-500/6')}
    >
      <div className="flex items-start gap-3">
        <div className={cn('min-w-0 flex-1 transition-opacity', isExcluded && 'opacity-55')}>
          <div className="flex min-w-0 items-center gap-1.5">
            <h4 className="min-w-0 truncate text-body font-medium text-foreground">{itemLabel}</h4>
            {lowConfidence && (
              <span className="shrink-0 rounded-full bg-amber-500/12 px-1.5 text-micro text-amber-700 dark:text-amber-300">Check</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-caption text-muted-foreground tabular-nums">{priceLine}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'text-right text-body font-semibold tabular-nums',
              isExcluded ? 'text-muted-foreground font-normal' : needsPrice ? 'text-amber-700 dark:text-amber-300' : 'text-foreground',
            )}
          >
            {isExcluded ? 'Not yours' : needsPrice ? 'Price needed' : formatCurrencyVal(itemCalculation?.total ?? 0, currency)}
          </span>
          {/* Delete sits on the line it removes; phones reach it by swiping the row instead. */}
          <IconButton
            variant="tertiary"
            type="button"
            onClick={() => onRemove(index)}
            label={`Delete ${itemLabel}`}
            tooltip="Delete this line"
            className="-mr-2 hidden shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/line:opacity-100 sm:inline-flex"
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <Button
          variant="tertiary"
          size="sm"
          type="button"
          aria-expanded={showBreakdown}
          aria-controls={breakdownId}
          onClick={() => setShowBreakdown(open => !open)}
          className="-ml-2.5 min-w-0 gap-1 whitespace-nowrap px-2.5 text-caption font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          Price details
          <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', showBreakdown && 'rotate-180')} aria-hidden="true" />
        </Button>

        <div className="flex shrink-0 items-center rounded-full bg-surface-2 p-0.5">
          <Button size="icon" variant="tertiary"
            type="button"
            onClick={() => onChangeQuantity(index, -1)}
            disabled={selected <= 0}
            className="rounded-full text-foreground hover:bg-surface-3 disabled:opacity-30 lg:size-8"
            aria-label={`Decrease quantity for item ${index + 1}`}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="min-w-12 text-center text-label tabular-nums text-foreground">
            <span aria-label={`Quantity for item ${index + 1}`}>{selected}</span>
            <span className="text-muted-foreground" aria-hidden="true"> / {maximum}</span>
          </span>
          <Button size="icon" variant="tertiary"
            type="button"
            onClick={() => onChangeQuantity(index, 1)}
            disabled={selected >= maximum}
            className="rounded-full text-foreground hover:bg-surface-3 disabled:opacity-30 lg:size-8"
            aria-label={`Increase quantity for item ${index + 1}`}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      {showBreakdown && <BreakdownPanel
        id={breakdownId}
        index={index}
        currency={currency}
        unitPrice={unitPrice}
        priceUnlocked={priceUnlocked}
        isExcluded={isExcluded}
        needsPrice={needsPrice}
        chargeAmount={chargeAmount}
        chargePercent={chargePercent}
        withExtras={itemCalculation?.total ?? 0}
        onTogglePriceLock={onTogglePriceLock}
        onUpdatePrice={onUpdatePrice}
      />}
    </SwipeableRow>
  )
}

/** The folded detail under a line, as three plain rows rather than three tiles. */
function BreakdownPanel({
  id,
  index,
  currency,
  unitPrice,
  priceUnlocked,
  isExcluded,
  needsPrice,
  chargeAmount,
  chargePercent,
  withExtras,
  onTogglePriceLock,
  onUpdatePrice,
}: {
  id: string
  index: number
  currency: string
  unitPrice: number | null
  priceUnlocked: boolean
  isExcluded: boolean
  needsPrice: boolean
  chargeAmount: number
  chargePercent: number
  withExtras: number
  onTogglePriceLock: (index: number) => void
  onUpdatePrice: (index: number, value: string) => void
}) {
  return (
    <dl id={id} className="mt-2 space-y-2 rounded-control bg-surface-2/70 p-3 text-caption">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Price each</dt>
        <dd className="flex min-w-0 items-center gap-1">
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
            className="w-28 text-right font-semibold"
          />
          <Button
            size="icon"
            variant="tertiary"
            type="button"
            onClick={() => onTogglePriceLock(index)}
            className="shrink-0 rounded-full text-muted-foreground hover:bg-surface-3 hover:text-foreground lg:size-8"
            title={priceUnlocked ? 'Lock' : 'Unlock'}
            aria-label={`${priceUnlocked ? 'Lock' : 'Unlock'} price for item ${index + 1}`}
          >
            {priceUnlocked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5 text-accent-ink" />}
          </Button>
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1 text-muted-foreground">
          Tax, service and discounts
          <InfoHint
            label="What the extras on this line are"
            text="Tax, service charges, and discounts are split across applicable items. This line's share."
            align="left"
            inline
          />
        </dt>
        {/* A line nobody is taking pays none of the receipt's extras. */}
        <dd className={cn('tabular-nums', !isExcluded && !needsPrice && chargeAmount < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
          {isExcluded || needsPrice
            ? '—'
            : <>
                {chargeAmount < 0 ? '−' : '+'}{formatCurrencyVal(Math.abs(chargeAmount), currency)}
                {Math.abs(chargePercent) >= 0.05 && <span className="text-muted-foreground"> · {Math.abs(chargePercent).toFixed(1)}%</span>}
              </>}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
        <dt className="font-medium text-foreground">With extras</dt>
        <dd className="font-semibold text-foreground tabular-nums">
          {isExcluded || needsPrice ? '—' : formatCurrencyVal(withExtras, currency)}
        </dd>
      </div>
    </dl>
  )
}
