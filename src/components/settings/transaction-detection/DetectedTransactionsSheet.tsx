import { Inbox } from 'lucide-react'
import type { PurchaseCapture } from '../../../lib/native/purchaseCapture'
import { formatAlertTime } from '../../../lib/native/purchaseCaptureStatus'
import { formatCurrencyVal } from '../../../lib/utils'
import { Badge } from '../../ui/Badge'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'

interface Props {
  isOpen: boolean
  onClose: () => void
  candidates: PurchaseCapture[]
  busy: boolean
  formOpen: boolean
  onReview: (candidate: PurchaseCapture) => void
  onDiscard: (id: string) => Promise<boolean>
}

const detectedAmount = (candidate: PurchaseCapture) => {
  const value = candidate.amount === undefined ? Number.NaN : Number(candidate.amount)
  return candidate.currency && Number.isFinite(value) ? formatCurrencyVal(value, candidate.currency) : null
}

function CaptureRow({ candidate, busy, formOpen, onReview, onDiscard }: Omit<Props, 'isOpen' | 'onClose' | 'candidates'> & { candidate: PurchaseCapture }) {
  const amount = detectedAmount(candidate)
  const finishing = Boolean(candidate.prepared)
  const title = candidate.description || 'Merchant not detected'
  return (
    <li className="space-y-3 rounded-control border border-border/60 bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className={candidate.description ? 'break-words text-body font-medium text-foreground' : 'text-body italic text-muted-foreground'}>{title}</p>
          <p className="text-xs text-muted-foreground">{candidate.sourceLabel} · {formatAlertTime(candidate.capturedAt)}</p>
        </div>
        {amount
          ? <p className="shrink-0 text-body font-medium tabular-nums text-foreground">{amount}</p>
          : <p className="shrink-0 text-xs text-muted-foreground">Amount not shown</p>}
      </div>
      {(candidate.possibleDuplicate || finishing) && (
        <div className="flex flex-wrap gap-1.5">
          {candidate.possibleDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
          {finishing && <Badge tone="accent">Finishing save</Badge>}
        </div>
      )}
      {candidate.possibleDuplicate && <p className="text-xs text-muted-foreground">A similar alert arrived around the same time. Check your Ledger before saving both.</p>}
      {finishing && <p className="text-xs text-muted-foreground">You approved this one. It is added to the Ledger automatically the next time the app is unlocked.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="tertiary" size="sm" disabled={busy || finishing} onClick={() => void onDiscard(candidate.id)}>Discard</Button>
        <Button variant="primary" size="sm" disabled={formOpen || finishing} onClick={() => onReview(candidate)} aria-label={`Review ${title}`}>Review</Button>
      </div>
    </li>
  )
}

export function DetectedTransactionsSheet({ isOpen, onClose, candidates, ...row }: Props) {
  const count = candidates.length
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Detected transactions"
      description={count ? `${count} waiting for review · newest first` : undefined}
    >
      {count === 0
        ? <EmptyState icon={<Inbox className="size-5" />} title="You’re all caught up" />
        : <ul className="space-y-2.5" aria-label="Detected transactions waiting for review">
            {candidates.map(candidate => <CaptureRow key={candidate.id} candidate={candidate} {...row} />)}
          </ul>}
    </BottomSheet>
  )
}
