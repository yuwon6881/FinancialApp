import { useEffect, useRef, useCallback } from 'react'
import type { QueuedOp } from '../../lib/outbox'
import type { LedgerAccount, RecurringPayment } from '../../types'
import type { AccountPlacementSelections } from '../../lib/accountPlacementMigration'
import type { ToastAction, ToastTone } from '../../components/ui/ToastViewport'

export interface UseAccountPlacementReviewOptions {
  token: string | null
  allAccounts: LedgerAccount[]
  allRecurringPayments: RecurringPayment[]
  getPendingOps: () => QueuedOp[]
  getFailedOps: () => QueuedOp[]
  mutateQueue: (modifier: (ops: QueuedOp[]) => QueuedOp[]) => void
  mutateFailedOps: (modifier: (ops: QueuedOp[]) => QueuedOp[]) => void
  showToast: (message: string, title?: string, tone?: ToastTone, action?: ToastAction) => void
  processQueue: () => Promise<void>
}

export function useAccountPlacementReview(options: UseAccountPlacementReviewOptions) {
  const {
    token,
    allAccounts,
    allRecurringPayments,
    getPendingOps,
    getFailedOps,
    mutateQueue,
    mutateFailedOps,
    showToast,
    processQueue,
  } = options

  const accountPlacementMigrationSignatureRef = useRef('')

  useEffect(() => {
    if (!token) return
    // Deliberately keyed on account identity only. isPendingSync is derived from the live queue, so
    // including it re-ran the migration on every enqueue/fail transition rather than when the set of
    // accounts actually changed -- which is the only thing that can unblock a placement.
    const signature = `${token}:${allAccounts.map(account => `${account.id}:${account.bucket}:${account.isArchived}`).sort().join('|')}`
    if (signature === accountPlacementMigrationSignatureRef.current) return
    accountPlacementMigrationSignatureRef.current = signature
    let cancelled = false
    void import('../../lib/accountPlacementMigration').then(({ migrateAccountPlacementOperations }) => {
      if (cancelled) return
      const result = migrateAccountPlacementOperations(getPendingOps(), getFailedOps(), allAccounts, allRecurringPayments)
      if (!result.changed) return
      mutateQueue(() => result.pendingOps)
      mutateFailedOps(() => result.failedOps)
      if (result.reviewCount > 0) {
        showToast(
          `${result.reviewCount} offline change${result.reviewCount === 1 ? '' : 's'} need an account before syncing. Review the failed sync items after setup.`,
          'Account placement needed',
          'warning',
        )
      }
    })
    return () => { cancelled = true }
  }, [allAccounts, allRecurringPayments, getFailedOps, getPendingOps, mutateFailedOps, mutateQueue, showToast, token])

  const resolveAccountPlacementOps = useCallback((operation: QueuedOp, selections: AccountPlacementSelections) => {
    void import('../../lib/accountPlacementMigration').then(({ resolveAccountPlacementOperation }) => {
      const resolved = resolveAccountPlacementOperation(operation, selections)
      mutateFailedOps(previous => previous.filter(item => item.id !== operation.id))
      mutateQueue(previous => previous.some(item => item.id === resolved.id) ? previous : [...previous, resolved])
      void processQueue()
    })
  }, [mutateFailedOps, mutateQueue, processQueue])

  const retryFailedOp = useCallback((id: string) => {
    const operation = getFailedOps().find(item => item.id === id)
    if (!operation || operation.needsAccountReview) return
    mutateFailedOps(previous => previous.filter(item => item.id !== id))
    mutateQueue(previous => previous.some(item => item.id === operation.id)
      ? previous
      : [...previous, { ...operation, retryCount: 0, lastError: undefined }])
    // Deliberately user-initiated. accountPlacementMigration documents why automatically
    // requeuing unchanged failures from an effect can create a render/sync loop.
    void processQueue()
  }, [getFailedOps, mutateFailedOps, mutateQueue, processQueue])

  return {
    resolveAccountPlacementOps,
    retryFailedOp,
  }
}
