import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { InsightTone } from '../../lib/cycleSummaryTone'

export function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return <div className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-border/50 bg-muted/20 px-2 py-2.5 sm:flex-row sm:justify-between sm:px-3"><div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">{icon}{label}</div><div className="mt-1 max-w-full truncate text-xs font-bold text-foreground sm:mt-0 sm:text-sm">{value}</div></div>
}

const INSIGHT_TONE_TEXT: Record<InsightTone, string> = {
  good: 'text-emerald-500',
  warn: 'text-orange-500',
  neutral: 'text-foreground',
}

export function InsightCard({ title, value, detail, tone, trendUp, tooltipHint }: {
  title: string
  value: ReactNode
  detail: string
  tone: InsightTone
  trendUp?: boolean
  tooltipHint?: string
}) {
  const toneClass = INSIGHT_TONE_TEXT[tone]
  const trendColor = trendUp === undefined ? 'text-muted-foreground' : toneClass
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-muted-foreground" title={tooltipHint}>{title}</span>
        <div className="flex shrink-0 items-center gap-1">
          {trendUp !== undefined && (trendUp
            ? <TrendingUp className={`size-3 ${trendColor}`} />
            : <TrendingDown className={`size-3 ${trendColor}`} />)}
          <span className={`max-w-[10rem] truncate text-right text-xs font-bold ${toneClass}`}>{value}</span>
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground">{detail}</p>
    </div>
  )
}
