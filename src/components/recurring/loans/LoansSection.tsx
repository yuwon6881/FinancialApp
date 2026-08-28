import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Landmark, Plus, RefreshCw } from 'lucide-react'
import type { LedgerAccount, Loan, RecurringPayment } from '../../../types'
import { Button } from '../../ui/Button'
import { LoanCard } from './LoanCard'
import { LoanFormSheet } from './LoanFormSheet'
import { LoanRepaymentSheet } from '../LoanRepaymentSheet'
import { useLoansView } from './view/useLoansView'
import { RecurringFilterBar } from '../RecurringFilterBar'
import { InfoHint } from '../../ui/InfoHint'
import { useIsExpanded } from '../../../lib/breakpoints'
import type { LoanLoadStatus } from '../../../app/financialData/useLoanData'
import { useHighlightedElement } from '../../ui/useHighlightedElement'
import { listContainerVariants, listItemVariants } from '../../../lib/animations'
import { DataTablePagination } from '../../ui/DataTable'
import { useClientPagination } from '../../ui/useClientPagination'

interface LoansSectionProps {
  loans: Loan[]
  payments: RecurringPayment[]
  accounts?: LedgerAccount[]
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
  onAdvanceRepayment?: (id: string, cycles: number, accountId?: string, previewFingerprint?: string) => Promise<void>
  onFullSettlement?: (id: string, quoteAmount: number, accountId?: string) => Promise<void>
  onUndoRepayment?: (actionId: string, loanId?: string) => Promise<void>
  highlightedLoanId?: string | null
  onClearHighlightedLoan?: () => void
  /** Owned by the parent so the summary card's New Loan button can open this section's form. */
  isAddFormOpen: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
}
export function LoansSection({
  loans,
  payments,
  accounts = [],
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
  onAdvanceRepayment,
  onFullSettlement,
  onUndoRepayment,
  highlightedLoanId = null,
  onClearHighlightedLoan,
  isAddFormOpen,
  onOpenAddForm,
  onCloseAddForm,
}: LoansSectionProps) {
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [repayingLoan, setRepayingLoan] = useState<Loan | null>(null)

  const openAdd = () => {
    setEditingLoan(null)
    onOpenAddForm()
  }
  const openEdit = (loan: Loan) => {
    setEditingLoan(loan)
    onOpenAddForm()
  }
  const closeForm = () => onCloseAddForm()
  const handleSave = (loan: Partial<Loan>) => {
    if (editingLoan) {
      onUpdateLoan(editingLoan.id, { ...editingLoan, ...loan } as Loan)
    } else {
      onAddLoan(loan)
    }
  }

  const reduceMotion = useReducedMotion()
  const isMobile = !useIsExpanded()
  const view = useLoansView(loans, payments, activeSyncIds)
  const highlightedIndex = highlightedLoanId
    ? view.filteredAndSortedLoans.findIndex(loan => loan.id === highlightedLoanId)
    : -1
  const pagination = useClientPagination(view.filteredAndSortedLoans.length, 9, highlightedIndex)
  const visibleLoans = view.filteredAndSortedLoans.slice(pagination.start, pagination.end)

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
      {/* Adding a loan is the summary card's New Loan button, matching where New Subscription sits
          on the bills tab. Only the empty state repeats the action, where there is nothing else to do. */}
      <div>
        <h3 className="flex items-center gap-1 text-sm font-bold text-foreground sm:text-base">
          Tracked loans
          <InfoHint
            label="tracked loans"
            text="Follow repayments, interest splits, and estimated payoff dates."
          />
        </h3>
      </div>

      {/* One loan has nothing to filter or sort, and two controls above a single card is most of
          what makes this screen feel busy. */}
      {loans.length > 1 && (
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
        <m.div
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          variants={listContainerVariants}
          className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
        >
          {visibleLoans.map(loan => (
            <m.div key={loan.id} variants={listItemVariants}>
              <LoanCard
                loan={loan}
                currency={currency}
                hideSensitive={hideSensitive}
                formatSensitive={formatSensitive}
                isSyncing={view.activeSyncIdSet.has(loan.id)}
                isMobile={isMobile}
                onEdit={() => openEdit(loan)}
                onDelete={() => onRequestDeleteLoan(loan.id)}
                onExplain={() => onExplain(loan)}
                onRepay={() => setRepayingLoan(loan)}
                onUndoSettlement={loan.settlementActionId && onUndoRepayment
                  ? () => { void onUndoRepayment(loan.settlementActionId!, loan.id) }
                  : undefined}
              />
            </m.div>
          ))}
        </m.div>
        {view.filteredAndSortedLoans.length > pagination.pageSize && (
          <DataTablePagination
            currentPage={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={view.filteredAndSortedLoans.length}
            totalPages={pagination.totalPages}
            showPageSize={false}
            onPageChange={pagination.setPage}
            onPageSizeChange={() => undefined}
          />
        )}
        </div>
      )}

      <LoanFormSheet
        isOpen={isAddFormOpen}
        editingLoan={editingLoan}
        payments={payments}
        linkedPaymentIds={view.linkedPaymentIds}
        onClose={closeForm}
        onSave={handleSave}
      />

      <LoanRepaymentSheet
        isOpen={Boolean(repayingLoan)}
        loan={repayingLoan}
        payment={repayingLoan ? payments.find(p => p.id === repayingLoan.recurringPaymentId) : null}
        accounts={accounts}
        currency={currency}
        onClose={() => setRepayingLoan(null)}
        onAdvanceRepayment={onAdvanceRepayment ?? (async () => {})}
        onFullSettlement={onFullSettlement ?? (async () => {})}
      />
    </section>
  )
}
