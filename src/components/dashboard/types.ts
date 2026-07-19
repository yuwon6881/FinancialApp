// Mirrors the onNavigateToLedger options accepted by DashboardView's props so
// the extracted dashboard cards can share one declaration (structurally
// identical to the inline type on DashboardViewProps).
export interface NavigateToLedgerOptions {
  category?: string | null
  date?: string | null
  txType?: 'inflow' | 'outflow' | null
  range?: 'monthly' | '3month' | '6month' | 'yearly'
  highlightedTxId?: string | null
  showAllCycles?: boolean
}
