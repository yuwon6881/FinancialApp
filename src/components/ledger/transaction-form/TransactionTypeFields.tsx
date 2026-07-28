import { MinusCircle, PlusCircle, RefreshCw } from 'lucide-react'
import type { TransactionType } from './transactionFormReducer'

interface TransactionTypeFieldsProps {
  txType: TransactionType
  onChangeTxType: (type: TransactionType) => void
  /** Editing an existing entry: the type is fixed and cannot be switched. */
  disabled?: boolean
}

export function TransactionTypeFields({ txType, onChangeTxType, disabled = false }: TransactionTypeFieldsProps) {
  const base = `min-w-0 flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[9px] sm:text-[10px] whitespace-nowrap font-semibold rounded-xl border transition ${
    disabled ? 'cursor-not-allowed disabled:pointer-events-none' : 'cursor-pointer'
  }`

  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        Transaction Type
      </label>
      <div
        className="flex flex-wrap sm:flex-nowrap gap-2"
        title={disabled ? 'Transaction type cannot be changed while editing. Delete and re-add to change it.' : undefined}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeTxType('outflow')}
          className={`${base} ${
            txType === 'outflow'
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <MinusCircle className="size-3.5" /> Outflow (Debit)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeTxType('inflow')}
          className={`${base} ${
            txType === 'inflow'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <PlusCircle className="size-3.5" /> Inflow (Credit)
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChangeTxType('transfer')}
          className={`${base} ${
            txType === 'transfer'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
              : `border-border text-muted-foreground ${disabled ? 'opacity-45' : 'hover:bg-muted/50'}`
          }`}
        >
          <RefreshCw className="size-3.5" /> Transfer
        </button>
      </div>
    </div>
  )
}
