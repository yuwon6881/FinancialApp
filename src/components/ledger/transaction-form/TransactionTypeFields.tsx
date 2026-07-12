import { MinusCircle, PlusCircle, RefreshCw } from 'lucide-react'
import type { TransactionType } from './transactionFormReducer'

interface TransactionTypeFieldsProps {
  txType: TransactionType
  onChangeTxType: (type: TransactionType) => void
}

export function TransactionTypeFields({ txType, onChangeTxType }: TransactionTypeFieldsProps) {
  return (
    <div className="space-y-1 sm:col-span-2">
      <label className="text-xs font-semibold text-muted-foreground">Transaction Type</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChangeTxType('outflow')}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[9px] sm:text-[10px] whitespace-nowrap font-semibold rounded-xl border transition cursor-pointer ${
            txType === 'outflow'
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
              : 'border-border hover:bg-muted/50 text-muted-foreground'
          }`}
        >
          <MinusCircle className="size-3.5" /> Outflow (Debit)
        </button>
        <button
          type="button"
          onClick={() => onChangeTxType('inflow')}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[9px] sm:text-[10px] whitespace-nowrap font-semibold rounded-xl border transition cursor-pointer ${
            txType === 'inflow'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
              : 'border-border hover:bg-muted/50 text-muted-foreground'
          }`}
        >
          <PlusCircle className="size-3.5" /> Inflow (Credit)
        </button>
        <button
          type="button"
          onClick={() => onChangeTxType('transfer')}
          className={`min-w-0 flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[9px] sm:text-[10px] whitespace-nowrap font-semibold rounded-xl border transition cursor-pointer ${
            txType === 'transfer'
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-500'
              : 'border-border hover:bg-muted/50 text-muted-foreground'
          }`}
        >
          <RefreshCw className="size-3.5" /> Transfer
        </button>
      </div>
    </div>
  )
}
