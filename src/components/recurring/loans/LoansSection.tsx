import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Landmark, Plus, RefreshCw } from 'lucide-react'
import type { Loan, RecurringPayment } from '../../../types'
import { Button } from '../../ui/Button'
import { LoanCard } from './LoanCard'
import { LoanFormSheet } from './LoanFormSheet'
import { useLoansView } from './view/useLoansView'
import { RecurringFilterBar } from '../RecurringFilterBar'
import { useIsMobile } from '../../../lib/useIsMobile'
import type { LoanLoadStatus } from '../../../app/financialData/useLoanData'
import { useHighlightedElement } from '../../ui/useHighlightedElement'

interface LoansSectionProps {
  loans: Loan[]
  payments: RecurringPayment[]
  currency: string
  hideSensitive: boolean
  formatSensitive: (value: number) => ReactNode
  activeSyncIds: string[]
  onAddLoan: (loan: Partial<Loan>) => void
  onUpdateLoan: (id: string, loan: Loan) => void
  onRequestDeleteLoan: (id: string) => void
  loadStatus: LoanLoadStatus
  onLoad: () => Promise<Loan[]>
  onExplain: (loan: Loan) => void
  highlightedLoanId?: string | null
  onClearHighlightedLoan?: () => void
}
export function LoansSection({
  loans,
  payments,
  currency,
  hideSensitive,
  formatSensitive,
  activeSyncIds,
  onAddLoan,
  onUpdateLoan,
  onRequestDeleteLoan,
  loadStatus,
  onLoad,
  onExplain,
  highlightedLoanId = null,
  onClearHighlightedLoan,
}: LoansSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)

  const openAdd = () => {
    setEditingLoan(null)
    setIsFormOpen(true)
  }
  const openEdit = (loan: Loan) => {
    setEditingLoan(loan)
    setIsFormOpen(true)
  }
  const closeForm = () => setIsFormOpen(false)
  const handleSave = (loan: Partial<Loan>) => {
    if (editingLoan) {
      onUpdateLoan(editingLoan.id, { ...editingLoan, ...loan } as Loan)
    } else {
      onAddLoan(loan)
    }
  }

  const isMobile = useIsMobile()
  const view = useLoansView(loans, payments, activeSyncIds)

  useHighlightedElement(highlightedLoanId ? `loan-card-${highlightedLoanId}` : null, onClearHighlightedLoan)

  useEffect(() => {
    if (highlightedLoanId && view.selectedCategories.length > 0) {
      view.clearCategories()
    }
  }, [highlightedLoanId, view])

  useEffect(() => {
    void onLoad().catch(() => undefined)
  }, [onLoad])

  return (
    <section className="app-panel space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/92 sm:p-5" aria-label="Loans list">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground sm:text-base">Tracked loans</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Follow repayments, interest splits, and estimated payoff dates.</p>
        </div>
        <Button variant="primary" size="sm" className="size-10 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5" onClick={openAdd} aria-label="Add loan" title="Add loan">
          <Plus className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Add loan</span>
        </Button>
      </div>

      {loans.length > 0 && (
        <RecurringFilterBar
          isMobile={isMobile}
          selectedCategories={view.selectedCategories}
          sortOrder={view.sortOrder}
          isFilterDropdownOpen={view.isFilterDropdownOpen}
          filterButtonRef={view.filterButtonRef}
          setIsFilterDropdownOpen={view.setIsFilterDropdownOpen}
          onToggleCategoryFilter={view.toggleCategory}
          onClearFilters={view.clearCategories}
          onSortChange={view.setSortOrder}
          allLabel="All bill categories"
          filterAriaLabel="Filter loans by linked bill category"
          sortAriaLabel="Sort loans"
          sortOptions={[
            { value: 'amount-desc', label: 'Sort by: Amount owed (High to Low)' },
            { value: 'amount-asc', label: 'Sort by: Amount owed (Low to High)' },
            { value: 'name-asc', label: 'Sort by: Name (A-Z)' },
            { value: 'payoff-date', label: 'Sort by: Expected payoff' },
          ]}
        />
      )}

      {loadStatus === 'loading' && loans.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-muted/15 p-8 text-center" aria-busy="true">
          <RefreshCw className="mx-auto size-5 animate-spin text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-muted-foreground">Loading loans…</p>
        </div>
      ) : loadStatus === 'error' && loans.length === 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-center text-xs text-destructive">
          <p className="font-semibold">{navigator.onLine === false ? 'Loans are not available offline until loaded once.' : 'Could not load loans.'}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => void onLoad()}>Retry</Button>
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-center sm:p-8">
          <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-accent-ink/20 bg-accent/30 text-accent-ink">
            <Landmark className="size-5" aria-hidden="true" />
          </div>
          <h4 className="mt-3 text-sm font-bold text-foreground">No loans tracked yet</h4>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Link a recurring bill to see your real repayment progress, interest paid, and estimated payoff timeline.
          </p>
          <Button variant="primary" size="sm" className="mt-4" onClick={openAdd}>
            <Plus className="size-3.5" aria-hidden="true" />
            Add your first loan
          </Button>
        </div>
      ) : view.filteredAndSortedLoans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
          No loans match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {view.filteredAndSortedLoans.map(loan => (
            <LoanCard
              key={loan.id}
              loan={loan}
              currency={currency}
              hideSensitive={hideSensitive}
              formatSensitive={formatSensitive}
              isSyncing={view.activeSyncIdSet.has(loan.id)}
              isMobile={isMobile}
              onEdit={() => openEdit(loan)}
              onDelete={() => onRequestDeleteLoan(loan.id)}
              onExplain={() => onExplain(loan)}
            />
          ))}
        </div>
      )}

      <LoanFormSheet
        isOpen={isFormOpen}
        editingLoan={editingLoan}
        payments={payments}
        linkedPaymentIds={view.linkedPaymentIds}
        onClose={closeForm}
        onSave={handleSave}
      />
    </section>
  )
}
