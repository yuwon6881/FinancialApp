import { useMemo } from 'react'
import type {
  DashboardData,
  LedgerAccount,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  WishlistItem,
} from '../../types'
import { useOptimisticList } from '../../lib/useOptimisticList'
import { useOptimisticDashboard } from '../useOptimisticDashboard'
import { formatDateForApi, getCycleRangeDates, MONTH_NAMES } from '../../lib/cycle'
import { buildStabilityPlanPoints, projectStabilityReloadStatuses } from '../../lib/stabilityRecovery'
import { projectAccountBalances, projectAccountBalancesFromTransactions } from '../../lib/accountProjection'
import { projectLoanStates } from '../../lib/loanProjection'
import { loanEndDate } from '../../lib/loanTermSchedule'
import type { QueuedOp } from '../../lib/outbox'
import type { useLoanData } from './useLoanData'

interface ProjectionDependencies {
  activeOps: QueuedOp[]
  selectedMonth: string
  selectedYear: number
  dashboardData: DashboardData | null
  transactions: Transaction[]
  pendingLedgerTransactions: Transaction[]
  recurringPayments: RecurringPayment[]
  wishlist: WishlistItem[]
  savingsGoals: SavingsGoal[]
  accounts: LedgerAccount[]
  loanData: ReturnType<typeof useLoanData>
}

/**
 * Everything the views read is this projection, not the server snapshot: each list replays the
 * queued operations over its server rows, and the dashboard's per-account balances are re-derived
 * from the projected ledger so a queued row moves the balance it belongs to before it syncs.
 */
export function useProjectedFinancialData(deps: ProjectionDependencies) {
  const {
    activeOps,
    selectedMonth,
    selectedYear,
    dashboardData,
    transactions,
    pendingLedgerTransactions,
    recurringPayments,
    wishlist,
    savingsGoals,
    accounts,
    loanData,
  } = deps

  const optimisticDashboardData = useOptimisticDashboard(dashboardData, activeOps, transactions)

  // A queued salary generates four bucket rows server-side; projecting them needs the optimistic
  // plan percentages whenever the row was saved as plain `Income` (see incomeSplitProjection.ts).
  const incomeSplitOptions = useMemo(() => ({
    incomeAllocations: optimisticDashboardData?.setting
      ? {
          essentialsAlloc: optimisticDashboardData.setting.essentialsAlloc,
          growthAlloc: optimisticDashboardData.setting.growthAlloc,
          stabilityAlloc: optimisticDashboardData.setting.stabilityAlloc,
          rewardsAlloc: optimisticDashboardData.setting.rewardsAlloc,
        }
      : undefined,
    transactionDateRange: (() => {
      const monthIndex = MONTH_NAMES.indexOf(selectedMonth) + 1
      if (monthIndex <= 0 || !selectedYear) return undefined
      const range = getCycleRangeDates(
        selectedYear,
        monthIndex,
        optimisticDashboardData?.setting?.cycleDay || 28,
      )
      return { start: formatDateForApi(range.start), end: formatDateForApi(range.end) }
    })(),
  }), [
    optimisticDashboardData?.setting?.essentialsAlloc,
    optimisticDashboardData?.setting?.growthAlloc,
    optimisticDashboardData?.setting?.stabilityAlloc,
    optimisticDashboardData?.setting?.rewardsAlloc,
    optimisticDashboardData?.setting?.cycleDay,
    selectedMonth,
    selectedYear,
  ])
  const queuedTransactions = useOptimisticList(transactions, activeOps, 'transaction', {
    ...incomeSplitOptions,
    ledgerAccounts: accounts,
  })
  const allTransactions = useMemo(() => {
    // Direct server actions can create a ledger row before the next bootstrap response arrives.
    // Keep that row in the same collection consumed by LedgerView so changing tabs immediately
    // after the click cannot hide the in-flight transaction.
    const queuedIds = new Set(queuedTransactions.map(transaction => String(transaction.id)))
    const directTransactions = pendingLedgerTransactions.filter(transaction => !queuedIds.has(String(transaction.id)))
    const projected = [...directTransactions, ...queuedTransactions]
    const recovery = optimisticDashboardData?.stabilityRecovery
    if (!recovery || !dashboardData?.setting) return projected
    const planPoints = buildStabilityPlanPoints(
      dashboardData.stabilityRecovery?.target ?? dashboardData.setting.targetStabilityFund,
      dashboardData.setting.stabilityAlloc,
      activeOps
        .filter(operation => operation.entity === 'settings' && operation.type === 'update')
        .map(operation => ({ createdAt: operation.createdAt, payload: operation.payload as Record<string, unknown> | undefined })),
    )
    return projectStabilityReloadStatuses({
      recovery,
      baseTransactions: transactions,
      projectedTransactions: projected,
      stabilityAlloc: dashboardData.setting.stabilityAlloc,
      projectedBalance: recovery.currentBalance,
      planPoints,
    })
  }, [
    activeOps,
    dashboardData,
    optimisticDashboardData,
    pendingLedgerTransactions,
    queuedTransactions,
    transactions,
  ])
  const queuedRecurringPayments = useOptimisticList(recurringPayments, activeOps, 'recurringPayment')
  const allWishlist = useOptimisticList(wishlist, activeOps, 'wishlistItem')
  const allSavingsGoals = useOptimisticList(savingsGoals, activeOps, 'savingsGoal')
  const queuedAccounts = useOptimisticList(accounts, activeOps, 'ledgerAccount')
  const allAccounts = useMemo(
    () => projectAccountBalances(queuedAccounts, activeOps, transactions, incomeSplitOptions.incomeAllocations),
    [activeOps, incomeSplitOptions, queuedAccounts, transactions],
  )
  const optimisticDashboardWithAccounts = useMemo(() => {
    if (!optimisticDashboardData) return null

    const accountSnapshots = new Map(
      (dashboardData?.categories ?? []).flatMap(category =>
        (category.accounts ?? []).map(account => [account.id, account] as const)),
    )
    const snapshotAccounts = allAccounts.map(account => ({
      ...account,
      remaining: accountSnapshots.get(account.id)?.remaining ?? account.remaining,
    }))
    const projectedAccounts = projectAccountBalancesFromTransactions(
      snapshotAccounts,
      transactions,
      allTransactions,
    )
    const projectedById = new Map(projectedAccounts.map(account => [account.id, account]))

    return {
      ...optimisticDashboardData,
      categories: optimisticDashboardData.categories.map(category => {
        const serverAccounts = category.accounts ?? []
        const bucketAccounts = projectedAccounts.filter(account =>
          account.bucket.toLowerCase() === category.name.toLowerCase(),
        )
        if (serverAccounts.length === 0 && bucketAccounts.length === 0) return category
        const accountIds = new Set(serverAccounts.map(account => account.id))
        const accountsForCategory = [
          ...serverAccounts.map(account => ({
            ...account,
            remaining: projectedById.get(account.id)?.remaining ?? account.remaining,
          })),
          ...bucketAccounts
            .filter(account => !accountIds.has(account.id))
            .map(account => ({
              id: account.id,
              name: account.name,
              remaining: account.remaining,
              isArchived: account.isArchived,
            })),
        ]
        return { ...category, accounts: accountsForCategory }
      }),
    }
  }, [allAccounts, allTransactions, dashboardData, optimisticDashboardData, transactions])
  const queuedLoans = useOptimisticList(loanData.loans, activeOps, 'loan')
  const allLoans = useMemo(() => projectLoanStates(queuedLoans, activeOps, queuedRecurringPayments), [activeOps, queuedLoans, queuedRecurringPayments])
  const allRecurringPayments = useMemo(() => {
    const hasProjectedLoanMutation = activeOps.some(operation => operation.entity === 'loan')
    if (!loanData.hasLoadedFromServer && !hasProjectedLoanMutation) return queuedRecurringPayments
    return queuedRecurringPayments.map(payment => {
      const loan = allLoans.find(candidate => !candidate.isPendingDelete && candidate.recurringPaymentId === payment.id)
      const persistedLoan = loan ? loanData.loans.find(candidate => candidate.id === loan.id) : undefined
      const hasLoanTermMutation = loan && activeOps.some(operation => operation.entity === 'loan'
        && operation.targetId === loan.id
        && (operation.type === 'add' || operation.type === 'update')
        && typeof operation.payload?.termPeriods === 'number'
        && (operation.type === 'add'
          || !payment.endDate
          || operation.payload.termPeriods !== persistedLoan?.termPeriods))
      const projectedEndDate = hasLoanTermMutation ? loanEndDate(loan) : null
      return {
        ...payment,
        endDate: projectedEndDate ?? payment.endDate,
        linkedLoanId: loan?.id ?? null,
        linkedLoanName: loan?.name ?? null,
      }
    })
  }, [activeOps, allLoans, loanData.hasLoadedFromServer, queuedRecurringPayments])

  return {
    optimisticDashboardData,
    incomeSplitOptions,
    queuedTransactions,
    allTransactions,
    queuedRecurringPayments,
    allWishlist,
    allSavingsGoals,
    queuedAccounts,
    allAccounts,
    optimisticDashboardWithAccounts,
    queuedLoans,
    allLoans,
    allRecurringPayments,
  }
}
