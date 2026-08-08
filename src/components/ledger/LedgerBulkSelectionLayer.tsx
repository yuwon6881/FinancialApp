import { useEffect, useState } from 'react'
import type { Transaction } from '../../types'
import { useAppContext } from '../../contexts/AppContext'
import { CustomConfirmModal } from '../ui/CustomConfirmModal'
import { SelectionToolbar } from '../ui/SelectionToolbar'
import { Button } from '../ui/Button'
import { LedgerTransactionList } from './LedgerTransactionList'
import { useLedgerBulkSelection } from './view/useLedgerBulkSelection'
import type { LedgerListProps } from './ledgerListShared'
import { buildBulkTransactionDeleteRequest } from '../../app/financialData/transactionBulkActions'

interface LedgerBulkSelectionLayerProps {
  listProps: LedgerListProps
  allTransactions: readonly Transaction[]
  resetKey: string
  startInSelectionMode: boolean
  onExit: () => void
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
  startInSelectionMode,
  onExit,
}: LedgerBulkSelectionLayerProps) {
  const app = useAppContext()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const bulk = useLedgerBulkSelection({
    transactions: listProps.transactions,
    allTransactions,
    isDeleting: listProps.isTxDeleting,
    isSyncing: listProps.isTxSyncing,
    hideSensitive: listProps.hideSensitive,
    resetKey,
  })

  useEffect(() => {
    if (startInSelectionMode) bulk.startSelection()
  }, [bulk.startSelection, startInSelectionMode])

  const leaveSelection = () => {
    bulk.leaveSelection()
    onExit()
  }

  return (
    <>
      <SelectionToolbar
        testId="ledger-selection-toolbar"
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
          <Button
            variant="destructive"
            size="sm"
            type="button"
            disabled={listProps.hideSensitive || bulk.exceedsLimit}
            onClick={() => {
              if (!app.guardSensitive()) return
              setIsConfirmOpen(true)
            }}
            aria-label="Delete selected transactions"
          >
            Delete
          </Button>
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
            <p>This removes the selected ledger entries immediately and queues the change if you are offline.</p>
            <p>Income Auto-Split selections delete their parent and generated split rows together. Attached Vault documents will be kept.</p>
            <p className="font-semibold text-orange-500/90">You can use Undo in the success notification to restore this batch.</p>
          </div>
        )}
        confirmText="Delete selected"
        cancelText="Cancel"
        confirmDisabled={bulk.selectedCount === 0 || bulk.exceedsLimit}
        onConfirm={() => {
          if (!app.guardSensitive()) {
            setIsConfirmOpen(false)
            return
          }
          const request = buildBulkTransactionDeleteRequest(bulk.selectedTransactions)
          if (request && app.queueMutation) {
            app.queueMutation('transaction', 'bulkDelete', request.targetId, request.payload)
          }
          bulk.leaveSelection()
          setIsConfirmOpen(false)
          onExit()
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
