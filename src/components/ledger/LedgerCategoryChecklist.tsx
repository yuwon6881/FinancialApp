import React from 'react'
import { Checkbox } from '../ui/Checkbox'
import type { TransactionCategory } from '../../types'
import { getCategoryDotClass, getCategoryFilterClass } from '../../lib/categoryColors'
import { LEDGER_BUCKETS as LEDGER_BUCKET_VALUES } from '../../lib/transactionFilters'

const LEDGER_BUCKETS: readonly string[] = LEDGER_BUCKET_VALUES

export interface LedgerCategoryChecklistProps {
  checkboxFilters: string[]
  availableCategories: TransactionCategory[]
  onToggleFilter: (filterName: string) => void
  isMobile?: boolean
}

export const LedgerCategoryChecklist: React.FC<LedgerCategoryChecklistProps> = ({
  checkboxFilters,
  availableCategories,
  onToggleFilter,
}) => {
  return (
    <div className="space-y-4">
      {/* Section 1: Ledger Allocation Buckets */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Ledger Categories
        </span>
        <div className="flex flex-wrap gap-1.5">
          {LEDGER_BUCKETS.map(bucket => {
            const isChecked = checkboxFilters.includes(bucket)
            return (
              <label
                key={bucket}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition active:scale-95 ${getCategoryFilterClass(bucket, isChecked)}`}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => onToggleFilter(bucket)}
                  className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                />
                <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(bucket)}`} />
                <span className="font-semibold">{bucket}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Section 2: Transaction Categories */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
          Categories
        </span>
        <div className="flex flex-wrap gap-1.5">
          {availableCategories.map(c => {
            const isChecked = checkboxFilters.includes(c.name)
            return (
              <label
                key={c.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition active:scale-95 ${getCategoryFilterClass(c.name, isChecked)}`}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => onToggleFilter(c.name)}
                  className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                />
                <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(c.name)}`} />
                <span className="font-semibold truncate max-w-[120px]">{c.name}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
