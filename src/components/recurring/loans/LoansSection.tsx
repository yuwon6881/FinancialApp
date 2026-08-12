import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Loan, RecurringPayment } from '../../../types'
import { Button } from '../../ui/Button'
import { InfoHint } from '../../ui/InfoHint'
import { LoanCard } from './LoanCard'
import { LoanFormSheet } from './LoanFormSheet'
import { useLoansView } from './view/useLoansView'

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

  const view = useLoansView(loans, activeSyncIds)

  return (
    <details
      className="group app-panel rounded-2xl border border-border/60 bg-card/92 transition-all duration-200"
      open={view.loans.length > 0}
    >
      <summary className="flex cursor-pointer select-none items-center justify-between gap-3 p-4 outline-none rounded-2xl focus-visible:ring-2 focus-visible:ring-ring/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          <h2 id="loans-heading" className="text-base font-bold text-foreground">Loans</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            view.loans.length > 0
              ? 'bg-primary/15 text-accent-ink font-bold'
              : 'bg-muted/60 text-muted-foreground'
          }`}>
            {view.loans.length}
          </span>
          <InfoHint label="loans" text="A loan is a view of a linked recurring bill. Its balance is replayed from the full ledger history, so deleting or restoring a payment changes the result." />
        </div>

        <div className="flex items-center gap-2" onClick={event => event.stopPropagation()}>
          <Button variant="primary" size="sm" onClick={openAdd}>Add loan</Button>
        </div>
      </summary>

      <div className="border-t border-border/40 px-4 pb-4 pt-3">
        <p className="mb-3 text-xs text-muted-foreground">
          Track what is still owed without adding extra loan rows to your ledger.
        </p>

        {view.loans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3.5 text-xs text-muted-foreground">
            No loans yet. Add one to see the linked bill's payment history and estimated payoff.
          </div>
        ) : (
          <div className="space-y-4">
            {view.loans.map(loan => (
              <LoanCard
                key={loan.id}
                loan={loan}
                currency={currency}
                hideSensitive={hideSensitive}
                formatSensitive={formatSensitive}
                isSyncing={view.activeSyncIdSet.has(loan.id)}
                onEdit={() => openEdit(loan)}
                onDelete={() => onRequestDeleteLoan(loan.id)}
              />
            ))}
          </div>
        )}
      </div>

      <LoanFormSheet
        isOpen={isFormOpen}
        editingLoan={editingLoan}
        payments={payments}
        linkedPaymentIds={view.linkedPaymentIds}
        onClose={closeForm}
        onSave={handleSave}
      />
    </details>
  )
}
