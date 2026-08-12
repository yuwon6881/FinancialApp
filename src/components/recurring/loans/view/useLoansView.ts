import { useMemo } from 'react'
import type { Loan } from '../../../../types'

export function useLoansView(loans: Loan[], activeSyncIds: string[]) {
  return useMemo(() => ({
    loans,
    linkedPaymentIds: new Set(loans.map(loan => loan.recurringPaymentId)),
    activeSyncIdSet: new Set(activeSyncIds),
  }), [activeSyncIds, loans])
}
