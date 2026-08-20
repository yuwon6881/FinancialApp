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
}

// The "Export Ledger CSV" bottom sheet. All the export logic (page vs. full
// result, server-side download) stays in LedgerView; this is purely the modal.
export function LedgerExportModal({
  isOpen,
  exportIsFetching,
  onClose,
  onExportPage,
  onExportAll,
  fullExportDisabled = false,
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
            variant="outline"
            onClick={onClose}
            disabled={exportIsFetching}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={onExportPage}
            disabled={exportIsFetching}
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
        <p>
          Choose whether to export the current page or the full result set based on your active filters.
        </p>
        <p className="text-[10px] text-muted-foreground">
          Full exports use a server-side download to avoid large client loads.
        </p>
        {fullExportDisabled && (
          <p className="text-[10px] font-medium text-orange-500">
            Full export becomes available after matching transactions finish syncing.
          </p>
        )}
      </div>
    </BottomSheet>
  )
}
