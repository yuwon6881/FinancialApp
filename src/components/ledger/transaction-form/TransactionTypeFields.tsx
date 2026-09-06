import { Button } from '../../ui/Button'
import { MinusCircle, PlusCircle, RefreshCw } from 'lucide-react'
import type { TransactionType } from './transactionFormReducer'

interface TransactionTypeFieldsProps {
  txType: TransactionType
  onChangeTxType: (type: TransactionType) => void
  /** Editing an existing entry: the type is fixed and cannot be switched. */
  disabled?: boolean
}

export function TransactionTypeFields({ txType, onChangeTxType, disabled = false }: TransactionTypeFieldsProps) {
  const base = `min-w-0 flex-1 flex items-center justify-center gap-1 px-1 py-2 text-xs sm:text-xs whitespace-nowrap font-semibold rounded-xl border transition ${
    disabled ? 'cursor-not-allowed disabled:pointer-events-none' : 'cursor-pointer'
  }`

  return (
    <fieldset className="min-w-0 space-y-1.5 sm:col-span-2">
      <legend className="text-xs font-bold text-muted-foreground">
        Transaction Type
      </legend>
      <div
        role="radiogroup"
        aria-label="Transaction type"
        className="flex flex-wrap sm:flex-nowrap gap-2"
        title={disabled ? 'Transaction type cannot be changed while editing. Delete and re-add to change it.' : undefined}
      >
        <Button variant="tertiary"
          type="button"
          role="radio"
          aria-checked={txType === 'outflow'}
          disabled={disabled}
          onClick={() => onChangeTxType('outflow')}
          className={`${base} ${
            txType === 'outflow'
              ? 'bg-orange-500/10 hover:bg-orange-500/10 border-orange-500/30 text-orange-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <MinusCircle className="size-3.5" /> Outflow <span className="hidden sm:inline">(Debit)</span>
        </Button>
        <Button variant="tertiary"
          type="button"
          role="radio"
          aria-checked={txType === 'inflow'}
          disabled={disabled}
          onClick={() => onChangeTxType('inflow')}
          className={`${base} ${
            txType === 'inflow'
              ? 'bg-blue-500/10 hover:bg-blue-500/10 border-blue-500/30 text-blue-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <PlusCircle className="size-3.5" /> Inflow <span className="hidden sm:inline">(Credit)</span>
        </Button>
        <Button variant="tertiary"
          type="button"
          role="radio"
          aria-checked={txType === 'transfer'}
          disabled={disabled}
          onClick={() => onChangeTxType('transfer')}
          className={`${base} ${
            txType === 'transfer'
              ? 'bg-blue-500/10 hover:bg-blue-500/10 border-blue-500/30 text-blue-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <RefreshCw className="size-3.5" /> Transfer
        </Button>
      </div>
    </fieldset>
  )
}
