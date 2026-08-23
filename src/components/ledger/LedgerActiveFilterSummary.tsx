import React from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { getCycleLabelForDropdown } from '../../lib/cycleLabels'

const LEDGER_BUCKETS = ['Essentials', 'Growth', 'Stability', 'Rewards', 'Income']

export interface LedgerActiveFilterSummaryProps {
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  isCurrentCycle?: boolean
  selectedMonth: string
  selectedYear: number
  cycleDay: number
  hasAnyFilter: boolean
  activeCategoryFilters: string[]
  activeTxType: 'inflow' | 'outflow' | 'transfer' | null
  activeSearch: string
  activeSearchMode?: 'contains' | 'whole-word'
  activeStartDate: string
  activeEndDate: string
  activeMinAmount: string
  activeMaxAmount: string
  activeRecurringFilter: string
  activeWishlistFilter: string
  onResetFilters: () => void
}

export const LedgerActiveFilterSummary: React.FC<LedgerActiveFilterSummaryProps> = ({
  showAllCycles,
  cyclesRange,
  isCurrentCycle,
  selectedMonth,
  selectedYear,
  cycleDay,
  hasAnyFilter,
  activeCategoryFilters,
  activeTxType,
  activeSearch,
  activeSearchMode = 'contains',
  activeStartDate,
  activeEndDate,
  activeMinAmount,
  activeMaxAmount,
  activeRecurringFilter,
  activeWishlistFilter,
  onResetFilters,
}) => {
  const hasScopedRange = showAllCycles && cyclesRange && cyclesRange !== 'monthly' && cyclesRange !== 'all'
  if (!hasAnyFilter && !hasScopedRange) return null

  const parts: string[] = []
  if (showAllCycles) {
    if (cyclesRange === '3month') parts.push('last 3 cycles')
    else if (cyclesRange === '6month') parts.push('last 6 cycles')
    else if (cyclesRange === 'yearly') parts.push(`full year ${selectedYear}`)
    else parts.push('all cycles')
  } else {
    parts.push(isCurrentCycle !== false
      ? 'current cycle'
      : getCycleLabelForDropdown(selectedMonth, selectedYear, cycleDay))
  }

  const filterDetails: string[] = []
  const selectedBuckets = activeCategoryFilters.filter(f => LEDGER_BUCKETS.includes(f))
  const selectedCats = activeCategoryFilters.filter(f => !LEDGER_BUCKETS.includes(f))

  if (selectedBuckets.length > 0) {
    const names = selectedBuckets.map(b => `"${b}"`).join(' and ')
    filterDetails.push(`ledger category ${names}`)
  }
  if (selectedCats.length > 0) {
    const names = selectedCats.map(c => `"${c}"`).join(' and ')
    filterDetails.push(`category ${names}`)
  }
  if (activeStartDate || activeEndDate) {
    if (activeStartDate && activeEndDate && activeStartDate === activeEndDate) {
      filterDetails.push(`date ${activeStartDate}`)
    } else {
      filterDetails.push(`dates ${activeStartDate || 'any'} to ${activeEndDate || 'any'}`)
    }
  }
  if (activeMinAmount || activeMaxAmount) {
    filterDetails.push(`absolute amount ${activeMinAmount || '0'} to ${activeMaxAmount || 'any'}`)
  }
  if (activeTxType) {
    filterDetails.push(activeTxType === 'inflow' ? 'inflows only' : activeTxType === 'outflow' ? 'outflows only' : 'transfers only')
  }
  if (activeRecurringFilter === 'only') filterDetails.push('recurring transactions only')
  else if (activeRecurringFilter === 'exclude') filterDetails.push('excluding recurring transactions')
  if (activeWishlistFilter === 'only') filterDetails.push('reward purchases only')
  else if (activeWishlistFilter === 'exclude') filterDetails.push('excluding reward purchases')
  if (activeSearch) {
    filterDetails.push(`search "${activeSearch}"${activeSearchMode === 'whole-word' ? ' (whole word)' : ''}`)
  }

  const label = filterDetails.length > 0
    ? `Showing ${parts.join(', ')} — filtered by ${filterDetails.join(' & ')}`
    : `Showing ${parts.join(', ')}`

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 text-xs animate-in fade-in duration-200">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-blue-500 font-medium leading-relaxed">
        <span className="size-1.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
        <span className="min-w-0 break-words">{label}</span>
      </div>
      {hasAnyFilter && (
        <Button variant="unstyled"
          onClick={onResetFilters}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-blue-500 hover:text-blue-500 text-[10px] font-semibold transition cursor-pointer"
        >
          <X className="size-3" /> Clear filters
        </Button>
      )}
    </div>
  )
}
