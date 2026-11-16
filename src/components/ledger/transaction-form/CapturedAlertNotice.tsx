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
    <section aria-label="Detected transaction details" className="overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="flex items-center gap-3 px-3.5 py-3.5 sm:px-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-control border border-border bg-card text-accent-ink">
          <BellRing className="size-[18px]" aria-hidden="true" />
        </div>
        <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">Detected from {source || 'a payment alert'}</h3>
      </div>
      {notices.length > 0 && (
        <ul className="mx-3.5 mb-3 space-y-2 rounded-control border border-border bg-card px-3 py-2.5 sm:mx-4">
          {notices.map(notice => (
            <li key={notice} className="flex gap-2 text-xs leading-relaxed text-foreground">
              <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{notice}</span>
            </li>
          ))}
        </ul>
      )}
      {excerpt && (
        <DetailDisclosure
          label="Original notification"
          open={showAlert}
          onOpenChange={setShowAlert}
          className="border-t border-border px-3.5 sm:px-4 [&>summary]:min-h-11 lg:[&>summary]:min-h-9"
          bodyClassName="pb-3 pt-0"
        >
          <p className="whitespace-pre-wrap break-words rounded-control border border-border bg-card p-3 text-xs text-muted-foreground">{excerpt}</p>
        </DetailDisclosure>
      )}
    </section>
  )
}
