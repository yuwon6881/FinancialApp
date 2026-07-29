import { AlertTriangle, CheckCircle2, CircleDollarSign } from 'lucide-react'
import type { TaxYearReliefSummary } from '../../../types'

const money = (value: number) => `RM${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function TaxReliefOverview({ summary }: { summary: TaxYearReliefSummary | null }) {
  if (!summary) return null
  return (
    <section className="mb-4 rounded-2xl border border-border/60 bg-muted/20 p-4" aria-labelledby="tax-relief-overview">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="tax-relief-overview" className="flex items-center gap-2 text-sm font-black">
            <CircleDollarSign className="size-4 text-accent-ink" />{summary.taxYear} tax relief tracker
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {money(summary.confirmedAmount)} confirmed
            {summary.pendingReviewAmount > 0 && ` · ${money(summary.pendingReviewAmount)} waiting for review`}
          </p>
        </div>
        {summary.isPolicyProvisional && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3" /> Uses YA {summary.policyYear} limits provisionally
          </span>
        )}
      </div>
      {summary.categories.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-center text-[11px] text-muted-foreground">
          Categorise documents and confirm extracted amounts to see relief progress.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.categories.map(category => {
            const progress = category.limit > 0 ? Math.min(100, category.confirmedAmount / category.limit * 100) : 0
            const full = progress >= 100
            return (
              <article key={category.id} className={`rounded-xl border p-3 ${full ? 'border-emerald-500/30 bg-emerald-500/8' : 'border-border/60 bg-card'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold" title={category.name}>{category.name}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{money(category.confirmedAmount)} of {money(category.limit)}</p>
                  </div>
                  {full && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Relief limit reached" />}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${full ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px]">
                  <span className={full ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
                    {full ? 'Limit reached' : `${money(Math.max(0, category.limit - category.confirmedAmount))} room left`}
                  </span>
                  {category.pendingReviewAmount > 0 && <span className="font-semibold text-amber-600 dark:text-amber-400">+{money(category.pendingReviewAmount)} to review</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
        Confirmed document amounts are tracking aids, not an eligibility determination. Sub-limits and personal conditions may apply.
      </p>
    </section>
  )
}
