import { getCycleLabelForDropdown } from './cycleLabels'

export interface LedgerScope {
  showAllCycles: boolean
  cyclesRange?: 'monthly' | '3month' | '6month' | 'yearly' | 'all'
  isCurrentCycle?: boolean
  selectedMonth: string
  selectedYear: number
  cycleDay: number
}

/** The period the Ledger is showing, in the words its filter summary and export sheet share. */
export function describeLedgerScope(scope: LedgerScope): string {
  if (scope.showAllCycles) {
    if (scope.cyclesRange === '3month') return 'last 3 cycles'
    if (scope.cyclesRange === '6month') return 'last 6 cycles'
    if (scope.cyclesRange === 'yearly') return `full year ${scope.selectedYear}`
    return 'all cycles'
  }
  return scope.isCurrentCycle !== false
    ? 'current cycle'
    : getCycleLabelForDropdown(scope.selectedMonth, scope.selectedYear, scope.cycleDay)
}
