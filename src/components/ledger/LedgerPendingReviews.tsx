import { FileCheck2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass } from '../ui/panelStyles'

interface LedgerPendingReviewsProps {
  receiptReady: boolean
  receiptSplitReady: boolean
  onReviewReceipt?: () => void
  onReviewReceiptSplit?: () => void
}

export function LedgerPendingReviews({ receiptReady, receiptSplitReady, onReviewReceipt, onReviewReceiptSplit }: LedgerPendingReviewsProps) {
  if (!receiptReady && !receiptSplitReady) return null

  return (
    <section aria-labelledby="ledger-scan-ready-title" className={cn(panelClass, PANEL_TONES.info, 'p-4')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/12 text-blue-500">
            <FileCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id="ledger-scan-ready-title" className="text-sm font-bold text-foreground">Scan ready for review</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Your current page stays open until you choose what to review.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {receiptReady && onReviewReceipt && <Button type="button" variant="secondary" size="sm" onClick={onReviewReceipt}>Review transaction</Button>}
          {receiptSplitReady && onReviewReceiptSplit && <Button type="button" variant="secondary" size="sm" onClick={onReviewReceiptSplit}>Review receipt items</Button>}
        </div>
      </div>
    </section>
  )
}
