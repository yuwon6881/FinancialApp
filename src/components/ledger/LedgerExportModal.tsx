import { Download, Loader2 } from 'lucide-react'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'

interface LedgerExportModalProps {
  isOpen: boolean
  exportIsFetching: boolean
  onClose: () => void
  onExportPage: () => void
  onExportAll: () => void
}

// The "Export Ledger CSV" bottom sheet. All the export logic (page vs. full
// result, server-side download) stays in LedgerView; this is purely the modal.
export function LedgerExportModal({
  isOpen,
  exportIsFetching,
  onClose,
  onExportPage,
  onExportAll,
}: LedgerExportModalProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      title={
        <span className="flex items-center gap-2 text-blue-500">
          <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <Download className="size-5" />
          </span>
          <span className="text-foreground">Export Ledger CSV</span>
        </span>
      }
    >
      <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          Choose whether to export the current page or the full result set based on your active filters.
        </p>
        <p className="text-[10px] text-muted-foreground">
          Full exports use a server-side download to avoid large client loads.
        </p>
      </div>

      <div className="flex flex-col gap-2 mt-2">
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
          disabled={exportIsFetching}
          className="rounded-xl px-4 py-2 text-xs font-semibold shadow-md"
        >
          {exportIsFetching && <Loader2 className="size-3.5 animate-spin" />}
          Export Entire Result
        </Button>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={exportIsFetching}
          className="rounded-xl px-4 py-2 text-xs font-semibold"
        >
          Cancel
        </Button>
      </div>
    </BottomSheet>
  )
}
