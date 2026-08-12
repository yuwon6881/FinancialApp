import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { Loan, RecurringPayment } from '../../../types'
import { Button } from '../../ui/Button'
import { InfoHint } from '../../ui/InfoHint'
import { LoanCard } from './LoanCard'
import { LoanFormSheet } from './LoanFormSheet'
import { useLoansView } from './view/useLoansView'
import { RecurringFilterBar } from '../RecurringFilterBar'
import { useIsMobile } from '../../../lib/useIsMobile'
import type { LoanLoadStatus } from '../../../app/financialData/useLoanData'

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

  useEffect(() => {
    void onLoad().catch(() => undefined)
  }, [onLoad])

  return (
    <section className="app-panel space-y-4 rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-border/60 sm:bg-card/92 sm:p-5" aria-labelledby="loans-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id="loans-heading" className="text-base font-bold text-foreground">Loans</h2>
            <InfoHint label="loans" text="A loan keeps the bill history it was created from. Its cadence is captured at creation, and deleting or restoring a payment changes the replay without adding a second ledger row." />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Track what is still owed without adding extra loan rows to your ledger.</p>
        </div>
        <Button variant="primary" size="sm" className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5" onClick={openAdd} aria-label="Add loan">
          <Plus className="size-3" aria-hidden /> <span className="hidden sm:inline">Add loan</span>
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
        <div className="rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-xs text-muted-foreground" aria-busy="true">Loading loans…</div>
      ) : loadStatus === 'error' && loans.length === 0 ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-xs text-destructive">
          <p>{navigator.onLine === false ? 'Loans are not available offline until they have been loaded once.' : 'Loans could not be loaded.'}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => void onLoad()}>Retry</Button>
        </div>
      ) : loans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-xs text-muted-foreground text-center">
          No loans yet. Add one to see the linked bill's payment history and estimated payoff.
        </div>
      ) : view.filteredAndSortedLoans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-xs text-muted-foreground text-center">
          No loans match these filters.
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
