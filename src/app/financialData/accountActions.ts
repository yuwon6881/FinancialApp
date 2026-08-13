import type { LedgerAccount } from '../../types'
import { createFinalId, type OutboxPayload } from '../../lib/outbox'
import { triggerHaptic } from '../../lib/haptics'
import type { UseOutboxResult } from '../../lib/useOutbox'
import type { AppDialogs } from '../useAppDialogs'

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
  isDefault?: boolean
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
    const hasDefault = accounts.some(account => account.bucket === value.bucket && account.isDefault && !account.isArchived)
    const payload: OutboxPayload = {
      id,
      name: value.name.trim(),
      bucket: value.bucket,
      kind: value.kind,
      isArchived: false,
      isDefault: value.isDefault === true || (value.isDefault !== false && !hasDefault),
      openingAmount,
      remaining: openingAmount,
    }
    mutateQueue(previous => enqueue(previous, 'ledgerAccount', 'add', id, payload))
  }

  const handleUpdateAccount = (id: string, value: LedgerAccountInput) => {
    if (!guardSensitive()) return
    const previous = accounts.find(account => account.id === id)
    snapshotForUndo('ledgerAccount', id, previous)
    const hasOtherDefault = accounts.some(account =>
      account.id !== id
      && account.bucket === value.bucket
      && account.isDefault
      && !account.isArchived,
    )
    const isArchived = value.isArchived ?? false
    mutateQueue(queue => enqueue(queue, 'ledgerAccount', 'update', id, {
      ...value,
      name: value.name.trim(),
      isArchived,
      isDefault: !isArchived && (value.isDefault === true || !hasOtherDefault),
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

  return {
    handleAddAccount,
    handleUpdateAccount,
    handleDeleteAccount,
    requestDeleteAccount,
  }
}
