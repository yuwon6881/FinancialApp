export interface FinancialSetting {
  targetStabilityFund: number
  selectedMonth: string
  selectedYear: number
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  cycleDay: number
  darkMode: boolean | null
  hideSensitive: boolean
  stabilityOverflowRedirect?: string
  currency?: string
  // Current-cycle key ("yyyy-MM") the user last acknowledged an end-of-cycle summary for.
  // Null/undefined means they've never seen one. Drives the once-per-cycle summary trigger.
  lastSummaryCycleSeen?: string | null
}
