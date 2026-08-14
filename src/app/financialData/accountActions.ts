import type { LedgerAccount, LedgerAccountInterestFrequency } from '../../types'
import { createFinalId, type OutboxPayload } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'
import type { LedgerAccountReconcileInput } from '../../lib/api/accounts'

interface LedgerAccountActionDependencies {
  accounts: LedgerAccount[]
  guardSensitive: () => boolean
  enqueue: UseOutboxResult['enqueue']
  mutateQueue: UseOutboxResult['mutateQueue']
  snapshotForUndo: UseOutboxResult['snapshotForUndo']
  setConfirmModalData: AppDialogs['setConfirmModalData']
}

export interface LedgerAccountInput {
  id?: string
  name: string
  bucket: LedgerAccount['bucket']
  kind: LedgerAccount['kind']
  openingAmount?: number
  isArchived?: boolean
  interestEnabled?: boolean
  interestRatePercent?: number
  interestFrequency?: LedgerAccountInterestFrequency
}

export function createLedgerAccountActions(deps: LedgerAccountActionDependencies) {
  const {
    accounts,
    guardSensitive,
    enqueue,
    mutateQueue,
    snapshotForUndo,
    setConfirmModalData,
  } = deps

  const handleAddAccount = (value: LedgerAccountInput) => {
    if (!guardSensitive()) return
    const id = value.id ?? createFinalId('ledgerAccount')
    const openingAmount = Number.isFinite(value.openingAmount) ? Math.round((value.openingAmount ?? 0) * 100) / 100 : 0
    const payload: OutboxPayload = {
      id,
      name: value.name.trim(),
      bucket: value.bucket,
      kind: value.kind,
      isArchived: false,
      openingAmount,
      remaining: openingAmount,
      interestEnabled: value.interestEnabled === true,
      interestRatePercent: value.interestEnabled === true
        ? Math.round((value.interestRatePercent ?? 0) * 10000) / 10000
        : 0,
      interestFrequency: value.interestFrequency ?? 'Monthly',
    }
    mutateQueue(previous => enqueue(previous, 'ledgerAccount', 'add', id, payload))
  }

  const handleUpdateAccount = (id: string, value: LedgerAccountInput) => {
    if (!guardSensitive()) return
    const previous = accounts.find(account => account.id === id)
    if (previous && value.isArchived && !previous.isArchived) {
      const hasOtherLiveAccount = accounts.some(account =>
        account.id !== id && account.bucket === previous.bucket && !account.isArchived,
      )
      if (!hasOtherLiveAccount) {
        setConfirmModalData({
          title: 'Keep one account open',
          message: 'Every bucket needs one open account. Add another before closing this one.',
          confirmText: 'Close',
          onConfirm: () => undefined,
        })
        return
      }
    }
    snapshotForUndo('ledgerAccount', id, previous)
    const isArchived = value.isArchived ?? false
    const interestEnabled = value.interestEnabled ?? previous?.interestEnabled ?? false
    const interestRatePercent = interestEnabled
      ? Math.round((value.interestRatePercent ?? previous?.interestRatePercent ?? 0) * 10000) / 10000
      : 0
    mutateQueue(queue => enqueue(queue, 'ledgerAccount', 'update', id, {
      ...value,
      name: value.name.trim(),
      isArchived,
      interestEnabled,
      interestRatePercent,
      interestFrequency: value.interestFrequency ?? previous?.interestFrequency ?? 'Monthly',
      undoSnapshot: previous,
    }))
  }

  const handleDeleteAccount = (id: string) => {
    if (!guardSensitive()) return
    void triggerHaptic(30)
    const previous = accounts.find(account => account.id === id)
    snapshotForUndo('ledgerAccount', id, previous)
    mutateQueue(queue => enqueue(queue, 'ledgerAccount', 'delete', id, {
      name: previous?.name,
      undoSnapshot: previous,
    }))
  }

  const requestDeleteAccount = (id: string) => {
    if (!guardSensitive()) return
    const account = accounts.find(item => item.id === id)
    setConfirmModalData({
      title: 'Delete account',
      message: `Delete “${account?.name || 'this account'}”? Accounts with ledger activity must be archived instead.`,
      confirmText: 'Delete',
      onConfirm: () => handleDeleteAccount(id),
    })
  }

  const handleReconcileAccounts = (input: LedgerAccountReconcileInput) => {
    if (!guardSensitive()) return
    const undoTargets = input.targets.map(target => {
      const account = target.id ? accounts.find(candidate => candidate.id === target.id) : undefined
      return account
        ? {
            ...target,
            expectedCurrent: account.remaining,
            target: account.remaining,
            isArchived: account.isArchived,
          }
        : {
            ...target,
            expectedCurrent: target.target,
            target: 0,
            isArchived: true,
          }
    })
    mutateQueue(queue => enqueue(queue, 'ledgerAccountReconcile', 'add', input.operationId, {
      name: `${input.bucket} account reconciliation`,
      description: `Reconcile ${input.bucket} account balances`,
      reconciliation: input,
      undoReconciliation: {
        ...input,
        operationId: `${input.operationId}-undo`,
        targets: undoTargets,
      },
    }))
  }

  return {
    handleAddAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    requestDeleteAccount,
    handleReconcileAccounts,
  }
}
