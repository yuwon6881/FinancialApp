import { useState } from 'react'
import type { ReactNode } from 'react'
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
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5" aria-labelledby="loans-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="loans-heading" className="text-lg font-bold text-foreground">Loans</h2>
            <InfoHint label="loans" text="A loan is a view of a linked recurring bill. Its balance is replayed from the full ledger history, so deleting or restoring a payment changes the result." />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track what is still owed without adding extra loan rows to your ledger.</p>
        </div>
        <Button variant="primary" size="sm" onClick={openAdd}>Add loan</Button>
      </div>

      {view.loans.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
          No loans yet. Add one to see the linked bill's payment history and estimated payoff.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
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
