import { useEffect, useState } from 'react'
import type { DashboardData, Transaction } from '../types'
import type { QueuedOp } from '../lib/outbox'

export function useOptimisticDashboard(
  dashboardData: DashboardData | null,
  activeOps: QueuedOp[],
  transactions: Transaction[],
) {
  const [projected, setProjected] = useState<DashboardData | null>(null)

  useEffect(() => {
    let current = true
    if (!dashboardData || activeOps.length === 0) return () => { current = false }
    void import('../lib/optimisticDashboard').then(({ computeOptimisticDashboard }) => {
      if (current) setProjected(computeOptimisticDashboard(dashboardData, { activeOps, transactions }))
    })
    return () => { current = false }
  }, [dashboardData, activeOps, transactions])

  return activeOps.length === 0 ? dashboardData : projected ?? dashboardData
}
