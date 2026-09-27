import { useState } from 'react'
import { BellRing, Info } from 'lucide-react'
import { DetailDisclosure } from '../../ui/DetailDisclosure'

interface Props {
  source?: string
  notices?: string[]
  excerpt?: string
}

/** What a detected alert contributed to this form, and what the reviewer still has to confirm. */
export function CapturedAlertNotice({ source, notices = [], excerpt }: Props) {
  const [showAlert, setShowAlert] = useState(false)
  return (
    <div className="space-y-2 rounded-control border border-primary/25 bg-primary/5 p-3 text-sm">
      <div className="flex items-start gap-2.5">
        <BellRing className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden="true" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium text-foreground">Detected from {source || 'a payment alert'}</p>
          <p className="text-xs leading-snug text-muted-foreground">Check the details and fill in anything missing. Suggestions are only choices — nothing is saved until you tap Save.</p>
        </div>
      </div>
      {notices.length > 0 && (
        <ul className="space-y-1 pl-6.5">
          {notices.map(notice => (
            <li key={notice} className="flex gap-1.5 text-xs leading-snug text-foreground">
              <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      )}
      {excerpt && (
        <DetailDisclosure label="Original alert" open={showAlert} onOpenChange={setShowAlert} className="pl-6.5">
          <p className="whitespace-pre-wrap break-words rounded-control bg-background/70 p-2.5 text-xs text-muted-foreground">{excerpt}</p>
        </DetailDisclosure>
      )}
    </div>
  )
}
