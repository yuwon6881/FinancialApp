import { AlertCircle, ArrowLeftRight, CheckCircle2, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import type { CategoryFlowType, TransactionCategory } from '../../types'
import type { CategoryCleanupSuggestion } from '../../lib/api'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { PerimeterBeam } from '../ui/PerimeterBeam'
import { Badge } from '../ui/Badge'

const flowLabel = (flow?: CategoryFlowType | null) => flow === 'inflow'
  ? 'Money in'
  : flow === 'outflow' ? 'Money out' : 'Money in & out'

interface Props {
  open: boolean
  error: string | null
  reviewing: boolean
  suggestions: CategoryCleanupSuggestion[]
  editableCategories: TransactionCategory[]
  consolidateTargets: Record<string, string>
  setConsolidateTargets: Dispatch<SetStateAction<Record<string, string>>>
  applyingId: string | null
  canApply: boolean
  onClose: () => void
  onApply: (suggestion: CategoryCleanupSuggestion) => void
  onNavigateToLedger?: (options: { category?: string; txType?: 'inflow' | 'outflow'; showAllCycles?: boolean }) => void
}

export function CategoryCleanupReviewPanel({
  open,
  error,
  reviewing,
  suggestions,
  editableCategories,
  consolidateTargets,
  setConsolidateTargets,
  applyingId,
  canApply,
  onClose,
  onApply,
  onNavigateToLedger,
}: Props) {
  if (!open && !error) return null

  return (
    <section aria-labelledby="category-review-heading" className={`relative flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5 ${reviewing ? 'perimeter-beam-host' : ''}`}>
      {reviewing && <PerimeterBeam size={120} />}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 id="category-review-heading" className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Sparkles className="size-3.5 text-accent-ink" aria-hidden="true" /> AI Category Review
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">Review category purpose, flow, and recent usage before applying anything.</p>
        </div>
        <Button variant="tertiary" type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground sm:size-8" aria-label="Close AI category review">
          <ChevronUp className="size-3.5" />
        </Button>
      </header>

      {reviewing && <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 p-3 text-xs font-semibold text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-accent-ink" />Reviewing category names, flows, and usage…</div>}
      {error && <p role="alert" className="flex items-center gap-1 rounded-lg border border-orange-500/25 bg-orange-500/8 p-3 text-xs font-semibold text-orange-600 dark:text-orange-400"><AlertCircle className="size-3.5 shrink-0" />{error}</p>}
      {!reviewing && !error && suggestions.length === 0 && <p className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/8 p-3 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />No cleanup or flow corrections to propose.</p>}

      {!reviewing && suggestions.map(suggestion => {
        const confidence = Math.round(Math.max(0, Math.min(1, suggestion.confidence)) * 100)
        const consolidateOptions = editableCategories.filter(category =>
          !suggestion.categories.some(name => name.toLowerCase() === category.name.toLowerCase()))
        const target = consolidateTargets[suggestion.id] || ''
        const disabled = suggestion.type === 'consolidate' && !target
        const incompatibleType = suggestion.type === 'changeFlow'
          ? suggestion.targetFlow === 'inflow' ? 'outflow' : suggestion.targetFlow === 'outflow' ? 'inflow' : undefined
          : undefined
        return (
          <article key={suggestion.id} className="overflow-hidden rounded-xl border border-border/60 bg-background/75">
            <div className="space-y-2.5 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="info">
                  {suggestion.type === 'changeFlow' ? 'Flow correction' : suggestion.type}
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">{confidence}% confidence</span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-foreground">{suggestion.title}</h5>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{suggestion.summary}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {suggestion.categories.map(name => <Button variant="tertiary" key={name} type="button" onClick={() => onNavigateToLedger?.({ category: name, showAllCycles: true })} className={`press-scale inline-flex min-h-8 items-center rounded-md border px-2 text-xs font-semibold ${getCategoryBadgeClass(name)}`}>{name}</Button>)}
                {suggestion.type === 'changeFlow' && <span className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-2 text-xs font-semibold text-muted-foreground"><ArrowLeftRight className="size-3" />{flowLabel(suggestion.sourceFlow)} → <strong className="text-foreground">{flowLabel(suggestion.targetFlow)}</strong></span>}
              </div>
              {suggestion.type === 'consolidate' && <label className="block space-y-1 text-xs font-semibold text-muted-foreground">Move its entries to:<CustomSelect ariaLabel="Category consolidation target" value={target} onChange={value => setConsolidateTargets(previous => ({ ...previous, [suggestion.id]: String(value) }))} options={[{ value: '', label: 'Choose a category' }, ...consolidateOptions.map(category => ({ value: category.name, label: category.name }))]} className="w-full" /></label>}
            </div>
            <footer className="flex items-center justify-between gap-2 border-t border-border/50 bg-muted/15 px-3 py-2.5">
              <Button variant="tertiary" type="button" disabled={suggestion.affectedTransactionCount === 0 || !onNavigateToLedger} onClick={() => onNavigateToLedger?.({ category: suggestion.categories[0], txType: incompatibleType, showAllCycles: true })} className="min-h-11 min-w-0 rounded-lg px-2 text-left text-xs font-bold uppercase text-orange-600 disabled:text-muted-foreground sm:min-h-8">
                {suggestion.affectedTransactionCount > 0 ? `${suggestion.affectedTransactionCount} ledger ${suggestion.affectedTransactionCount === 1 ? 'entry' : 'entries'} need validation` : 'No ledger entries affected'}
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={() => onApply(suggestion)} disabled={!canApply || applyingId !== null || disabled} title={disabled ? 'Choose a category first' : 'Accept suggestion'} className="w-20 shrink-0">
                {applyingId === suggestion.id ? <Loader2 className="size-3 animate-spin" /> : 'Accept'}
              </Button>
            </footer>
          </article>
        )
      })}
    </section>
  )
}
