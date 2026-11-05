import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { Button } from '../../ui/Button'
import { SlidingMarker } from '../../ui/SlidingMarker'
import { useSlidingMarker } from '../../ui/useSlidingMarker'
import { cn } from '../../../lib/utils'
import type { TransactionType } from './transactionFormReducer'

interface TransactionTypeFieldsProps {
  txType: TransactionType
  onChangeTxType: (type: TransactionType) => void
  /** Editing an existing entry: the type is fixed and cannot be switched. */
  disabled?: boolean
}

const OPTIONS: Array<{ type: TransactionType; label: string; Icon: LucideIcon }> = [
  { type: 'outflow', label: 'Outflow', Icon: ArrowUpRight },
  { type: 'inflow', label: 'Inflow', Icon: ArrowDownLeft },
  { type: 'transfer', label: 'Transfer', Icon: ArrowLeftRight },
]

/**
 * Money out, money in, or money moved: one segmented control whose selected pill slides between
 * the three. Still a radio group underneath, so it reads as one choice of three.
 */
export function TransactionTypeFields({ txType, onChangeTxType, disabled = false }: TransactionTypeFieldsProps) {
  const { rowRef, box, itemRef } = useSlidingMarker(OPTIONS.findIndex(option => option.type === txType), OPTIONS.length)
  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="sr-only">Transaction Type</legend>
      <div
        ref={rowRef}
        role="radiogroup"
        aria-label="Transaction type"
        className={cn('relative isolate grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1', disabled && 'opacity-60')}
        title={disabled ? 'Transaction type cannot be changed while editing. Delete and re-add to change it.' : undefined}
      >
        <SlidingMarker box={box} shape="fill" className="rounded-full bg-card shadow-(--app-shadow) ring-1 ring-border/60" />
        {OPTIONS.map(({ type, label, Icon }, index) => {
          const selected = txType === type
          return (
            <Button
              key={type}
              ref={itemRef(index)}
              variant="tertiary"
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChangeTxType(type)}
              className={cn(
                'relative min-h-10 min-w-0 gap-1.5 px-2 text-label font-medium hover:bg-transparent disabled:opacity-100 lg:min-h-10',
                selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('relative size-4 shrink-0', selected && type === 'inflow' && 'text-emerald-600 dark:text-emerald-400')} aria-hidden="true" />
              <span className="relative truncate">{label}</span>
            </Button>
          )
        })}
      </div>
    </fieldset>
  )
}
