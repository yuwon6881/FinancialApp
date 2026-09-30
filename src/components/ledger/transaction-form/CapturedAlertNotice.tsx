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
      <div className="flex items-center gap-2">
        <BellRing className="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
        <p className="font-medium text-foreground">Detected from {source || 'a payment alert'}</p>
      </div>
      {notices.length > 0 && (
        <ul className="space-y-1">
          {notices.map(notice => (
            <li key={notice} className="flex gap-1.5 text-xs leading-snug text-foreground">
              <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      )}
      {excerpt && (
        <DetailDisclosure label="Original alert" open={showAlert} onOpenChange={setShowAlert}>
          <p className="whitespace-pre-wrap break-words rounded-control bg-background/70 p-2.5 text-xs text-muted-foreground">{excerpt}</p>
        </DetailDisclosure>
      )}
    </div>
  )
}
