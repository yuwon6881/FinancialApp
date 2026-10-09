import { FileCheck2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { NoticeCard } from '../ui/NoticeCard'

interface LedgerPendingReviewsProps {
  receiptReady: boolean
  receiptSplitReady: boolean
  onReviewReceipt?: () => void
  onReviewReceiptSplit?: () => void
}

export function LedgerPendingReviews({ receiptReady, receiptSplitReady, onReviewReceipt, onReviewReceiptSplit }: LedgerPendingReviewsProps) {
  if (!receiptReady && !receiptSplitReady) return null

  return (
    <NoticeCard
      tone="neutral"
      icon={<FileCheck2 />}
      titleId="ledger-scan-ready-title"
      title="Scan ready for review"
      description="Check what was read from the receipt before it is saved."
      actions={(
        <>
          {receiptReady && onReviewReceipt && <Button type="button" variant="primary" size="sm" onClick={onReviewReceipt}>Review transaction</Button>}
          {receiptSplitReady && onReviewReceiptSplit && <Button type="button" variant="secondary" size="sm" onClick={onReviewReceiptSplit}>Review receipt items</Button>}
        </>
      )}
    />
  )
}
