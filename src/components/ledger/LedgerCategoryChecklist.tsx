import React, { useEffect, useRef, useState } from 'react'
import { Checkbox } from '../ui/Checkbox'
import type { TransactionCategory } from '../../types'
import { getCategoryDotClass, getCategoryFilterClass } from '../../lib/categoryColors'
import { LEDGER_BUCKETS as LEDGER_BUCKET_VALUES } from '../../lib/transactionFilters'
import { cn } from '../../lib/utils'

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
  isMobile = false,
}) => {
  // In the dropdown the category list is the only part worth growing: it fills whatever height the
  // panel's taller column leaves it and scrolls past that, instead of stopping at a fixed cap and
  // leaving the rest of the column blank. The list is absolutely positioned inside its own track so
  // its own length never sizes the panel -- otherwise a long category list would push the whole
  // grid past the viewport and hand the scrolling back to the panel.
  // The bottom sheet keeps the fixed cap: it already scrolls as one column.
  const listRef = useRef<HTMLDivElement>(null)
  const [listOverflows, setListOverflows] = useState(false)

  // `overscroll-contain` is right only while this list has somewhere to scroll. An `overflow-y-auto`
  // box is a scroll container even when its content fits, and containment on one of those swallows
  // the wheel instead of passing it up -- so with a short category list the pointer sat over a dead
  // zone and the panel behind it would not move at all. Measured rather than guessed: the list is
  // as long as the user's own categories.
  useEffect(() => {
    const node = listRef.current
    if (!node) return
    const measure = () => setListOverflows(node.scrollHeight - node.clientHeight > 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    for (const child of Array.from(node.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [availableCategories])

  const track = isMobile ? '' : 'relative min-h-56 flex-1'
  const list = cn(
    'flex flex-col gap-1.5 overflow-y-auto pr-1',
    isMobile ? 'max-h-56' : 'absolute inset-0',
    listOverflows ? 'overscroll-contain' : 'overscroll-auto',
  )

  return (
    <div className={cn('flex flex-col gap-4', !isMobile && 'h-full min-h-0')}>
      {/* Section 1: Ledger Allocation Buckets */}
      <div className="flex shrink-0 flex-col gap-2">
        <span className="text-eyebrow uppercase text-muted-foreground block">
          Ledger Categories
        </span>
        <div className="flex flex-col gap-1.5">
          {LEDGER_BUCKETS.map(bucket => {
            const isChecked = checkboxFilters.includes(bucket)
            return (
              <label
                key={bucket}
                className={`flex w-full items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer select-none transition active:scale-[0.99] ${getCategoryFilterClass(bucket, isChecked)}`}
              >
                <Checkbox
                  checked={isChecked}
                  onChange={() => onToggleFilter(bucket)}
                  className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                />
                <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(bucket)}`} />
                <span className="min-w-0 flex-1 truncate font-semibold">{bucket}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Section 2: Transaction Categories */}
      <div className={cn('flex flex-col gap-2', !isMobile && 'min-h-0 flex-1')}>
        <span className="text-eyebrow uppercase text-muted-foreground block">
          Categories
        </span>
        <div className={track}>
          <div ref={listRef} className={list}>
            {availableCategories.map(c => {
              const isChecked = checkboxFilters.includes(c.name)
              return (
                <label
                  key={c.id}
                  className={`flex w-full items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer select-none transition active:scale-[0.99] ${getCategoryFilterClass(c.name, isChecked)}`}
                >
                  <Checkbox
                    checked={isChecked}
                    onChange={() => onToggleFilter(c.name)}
                    className="rounded border-border text-blue-500 focus:ring-ring size-3.5"
                  />
                  <span className={`size-2 shrink-0 rounded-full ${getCategoryDotClass(c.name)}`} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
