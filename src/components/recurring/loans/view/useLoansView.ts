import { useMemo, useRef, useState } from 'react'
import type { Loan, RecurringPayment } from '../../../../types'

export type LoanSortOrder = 'amount-desc' | 'amount-asc' | 'name-asc' | 'payoff-date'

export function useLoansView(
  loans: Loan[],
  payments: RecurringPayment[],
  activeSyncIds: string[],
) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<LoanSortOrder>('amount-desc')
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  const linkedPaymentIds = useMemo(() => new Set(loans.map(loan => loan.recurringPaymentId)), [loans])
  const activeSyncIdSet = useMemo(() => new Set(activeSyncIds), [activeSyncIds])
  const paymentById = useMemo(() => new Map(payments.map(payment => [payment.id, payment])), [payments])

  const filteredAndSortedLoans = useMemo(() => {
    const category = (loan: Loan) => loan.recurringPaymentLedgerCategory
      ?? paymentById.get(loan.recurringPaymentId)?.ledgerCategory
      ?? ''
    const validPayoff = (loan: Loan) => loan.scheduleStatus !== 'Incomplete'
      && !loan.isRecalculating
      && Boolean(loan.snapshot.payoffDate)
    const tieBreak = (left: Loan, right: Loan) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
    return loans
      .filter(loan => selectedCategories.length === 0 || selectedCategories.includes(category(loan)))
      .sort((left, right) => {
        if (sortOrder === 'name-asc') return tieBreak(left, right)
        if (sortOrder === 'payoff-date') {
          const leftValid = validPayoff(left)
          const rightValid = validPayoff(right)
          if (leftValid !== rightValid) return leftValid ? -1 : 1
          if (leftValid && rightValid) {
            const byDate = left.snapshot.payoffDate!.localeCompare(right.snapshot.payoffDate!)
            if (byDate !== 0) return byDate
          }
          return tieBreak(left, right)
        }
        const direction = sortOrder === 'amount-asc' ? 1 : -1
        const byAmount = (left.snapshot.outstandingBalance - right.snapshot.outstandingBalance) * direction
        return byAmount || tieBreak(left, right)
      })
  }, [loans, paymentById, selectedCategories, sortOrder])

  const toggleCategory = (category: string) => {
    setSelectedCategories(current => current.includes(category)
      ? current.filter(value => value !== category)
      : [...current, category])
  }

  return {
    filteredAndSortedLoans,
    linkedPaymentIds,
    activeSyncIdSet,
    selectedCategories,
    sortOrder,
    isFilterDropdownOpen,
    filterButtonRef,
    setSortOrder: (value: string) => setSortOrder(value as LoanSortOrder),
    setIsFilterDropdownOpen,
    toggleCategory,
    clearCategories: () => setSelectedCategories([]),
  }
}
