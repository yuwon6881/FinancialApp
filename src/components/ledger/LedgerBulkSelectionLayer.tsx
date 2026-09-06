import { useState } from 'react'
import type { Transaction } from '../../types'
import { useAppContext } from '../../contexts/AppContext'
import { CustomConfirmModal } from '../ui/CustomConfirmModal'
import { SelectionToolbar } from '../ui/SelectionToolbar'
import { Button } from '../ui/Button'
import { LedgerTransactionList } from './LedgerTransactionList'
import { LEDGER_BULK_LIMIT, useLedgerBulkSelection } from './view/useLedgerBulkSelection'
import type { LedgerListProps } from './ledgerListShared'
import { buildBulkTransactionDeleteRequest } from '../../app/financialData/transactionBulkActions'
import { LedgerMoveSheet } from './LedgerMoveSheet'
import { transactionMoveIneligibility } from './transactionMoveEligibility'

interface LedgerBulkSelectionLayerProps {
  listProps: LedgerListProps
  allTransactions: readonly Transaction[]
  resetKey: string
  cycleDay: number
}

/**
 * This stays mounted beside the normal ledger route. Changing selection mode only changes row
 * props, so the list's keyed entrance container is reused and its animation does not replay when
 * the toolbar or the first page checkbox is clicked.
 */
export function LedgerBulkSelectionLayer({
  listProps,
  allTransactions,
  resetKey,
  cycleDay,
}: LedgerBulkSelectionLayerProps) {
  const app = useAppContext()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isMoveOpen, setIsMoveOpen] = useState(false)
  const bulk = useLedgerBulkSelection({
    transactions: listProps.transactions,
    allTransactions,
    isDeleting: listProps.isTxDeleting,
    isSyncing: listProps.isTxSyncing,
    hideSensitive: listProps.hideSensitive,
    resetKey,
  })

  const leaveSelection = () => {
    bulk.leaveSelection()
  }

  const blockedMoveReason = bulk.selectedTransactions
    .map(transactionMoveIneligibility)
    .find(reason => reason != null) ?? null

  return (
    <>
      <SelectionToolbar
        testId="ledger-selection-toolbar"
        // The enforced cap, not the toolbar's own default: the two happened to agree at 100, so
        // changing one would have left the "max N" message describing a limit nothing applies.
        selectionLimit={LEDGER_BULK_LIMIT}
        itemCount={bulk.eligibleVisibleCount}
        selectedCount={bulk.selectedCount}
        allVisibleSelected={bulk.allVisibleSelected}
        someVisibleSelected={bulk.someVisibleSelected}
        isSelecting={bulk.isSelecting}
        onStartSelection={bulk.startSelection}
        onToggleSelectAll={bulk.toggleSelectAll}
        onLeaveSelection={leaveSelection}
        disabled={listProps.hideSensitive}
        itemLabel="transactions"
        actions={bulk.selectedCount > 0 && (
          <div className="flex gap-2"><Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={listProps.hideSensitive || blockedMoveReason != null}
            // The sheet already explains why a row cannot move; without this the bulk button was
            // simply dead, with nothing on screen saying which selection was blocking it.
            title={blockedMoveReason ?? undefined}
            aria-label={blockedMoveReason ? `Cannot move the selected transactions: ${blockedMoveReason}` : undefined}
            onClick={() => {
              if (!app.guardSensitive()) return
              setIsMoveOpen(true)
            }}
          >Move</Button><Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={listProps.hideSensitive}
            onClick={() => {
              if (!app.guardSensitive()) return
              setIsConfirmOpen(true)
            }}
            aria-label="Delete selected transactions"
          >
            Delete
          </Button></div>
        )}
      />

      <LedgerTransactionList
        {...listProps}
        isSelecting={bulk.isSelecting}
        isSelected={bulk.isSelected}
        canSelect={bulk.canSelect}
        onToggleSelected={bulk.toggleSelected}
      />

      <CustomConfirmModal
        isOpen={isConfirmOpen}
        title={`Delete ${bulk.selectedCount} transaction${bulk.selectedCount === 1 ? '' : 's'}?`}
        message={(
          <div className="space-y-2">
            <p>This removes the selected entries immediately and queues the change if offline.</p>
            <p>Income Auto-Split selections include the parent and split rows. Vault documents stay.</p>
            <p className="font-semibold text-orange-500/90">Undo is available in the success notification.</p>
          </div>
        )}
        confirmText="Delete selected"
        cancelText="Cancel"
        confirmDisabled={bulk.selectedCount === 0}
        onConfirm={() => {
          if (!app.guardSensitive()) {
            setIsConfirmOpen(false)
            return
          }
          const request = buildBulkTransactionDeleteRequest(bulk.selectedTransactions)
          if (!request || !app.queueMutation?.('transaction', 'bulkDelete', request.targetId, request.payload)) return
          bulk.leaveSelection()
          setIsConfirmOpen(false)
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
      <LedgerMoveSheet
        isOpen={isMoveOpen}
        transactions={bulk.selectedTransactions}
        cycleDay={cycleDay}
        onClose={() => setIsMoveOpen(false)}
        onMoved={bulk.leaveSelection}
      />
    </>
  )
}
