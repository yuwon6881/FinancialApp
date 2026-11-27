import { Download, Loader2 } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

interface LedgerExportModalProps {
  isOpen: boolean
  exportIsFetching: boolean
  onClose: () => void
  onExportPage: () => void
  onExportAll: () => void
  fullExportDisabled?: boolean
  pageExportUnavailable?: boolean
  /** The period on screen, e.g. "current cycle" or "last 3 cycles". */
  scopeLabel?: string
  /** Rows the current page shows. */
  pageCount?: number
  /** Rows the whole matching result holds; absent while it is still unknown. */
  totalCount?: number | null
  /** Whether a search or filter narrows the result. */
  filtered?: boolean
}

const rowsLabel = (count: number) => `${count.toLocaleString()} ${count === 1 ? 'transaction' : 'transactions'}`

// The "Export Ledger CSV" bottom sheet. All the export logic (page vs. full
// result, server-side download) stays in LedgerView; this is purely the modal.
export function LedgerExportModal({
  isOpen,
  exportIsFetching,
  onClose,
  onExportPage,
  onExportAll,
  fullExportDisabled = false,
  pageExportUnavailable = false,
  scopeLabel,
  pageCount,
  totalCount,
  filtered = false,
}: LedgerExportModalProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      title={
        <span className="flex items-center gap-2 text-accent-ink">
          <span className="p-1.5 rounded-lg bg-primary/10 text-accent-ink">
            <Download className="size-5" />
          </span>
          <span className="text-foreground">Export Ledger CSV</span>
        </span>
      }
      footer={
        <ModalActions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={exportIsFetching}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={onExportPage}
            disabled={exportIsFetching || pageExportUnavailable}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Export This Page
          </Button>
          <Button
            variant="primary"
            onClick={onExportAll}
            disabled={exportIsFetching || fullExportDisabled}
            className="rounded-xl px-4 py-2 text-xs font-semibold shadow-md"
          >
            {exportIsFetching && <Loader2 className="size-3.5 animate-spin" />}
            Export Entire Result
          </Button>
        </ModalActions>
      }
    >
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {scopeLabel && (
          <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-label">
            <dt>Showing</dt>
            <dd className="min-w-0 text-right text-foreground first-letter:uppercase">
              {scopeLabel}{filtered ? ', filtered' : ''}
            </dd>
            {!pageExportUnavailable && pageCount !== undefined && (
              <>
                <dt>This page</dt>
                <dd className="min-w-0 text-right text-foreground tabular-nums">{rowsLabel(pageCount)}</dd>
              </>
            )}
            {totalCount != null && (
              <>
                <dt>Entire result</dt>
                <dd className="min-w-0 text-right text-foreground tabular-nums">{rowsLabel(totalCount)}</dd>
              </>
            )}
          </dl>
        )}
        {pageExportUnavailable && (
          <p>This page can be exported after its saved transactions load.</p>
        )}
        {fullExportDisabled && (
          <p className="text-xs font-medium text-orange-500">
            Full export becomes available after matching transactions finish syncing.
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
